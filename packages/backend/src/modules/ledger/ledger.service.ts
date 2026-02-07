import { Currency, LedgerEntryType, Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';
import {
  CreateLedgerEntryRequest,
  LedgerEntryResponse,
  AccountBalance,
  LedgerSummary,
  ListLedgerEntriesFilter,
  LedgerEntryListResponse,
  LedgerError,
  AccountCode,
} from './ledger.types.js';

export class LedgerService {
  private static instance: LedgerService | null = null;

  private constructor() {}

  static getInstance(): LedgerService {
    if (!LedgerService.instance) {
      LedgerService.instance = new LedgerService();
    }
    return LedgerService.instance;
  }

  /**
   * Record a balanced set of double-entry ledger entries for a transaction.
   * Total debits must equal total credits.
   */
  async recordEntries(
    transactionId: string,
    entries: CreateLedgerEntryRequest[]
  ): Promise<LedgerEntryResponse[]> {
    // Validate transaction exists
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw LedgerError.transactionNotFound(transactionId);
    }

    // Validate double-entry balance: debits must equal credits per currency
    this.validateBalance(transactionId, entries);

    logger.info('Recording ledger entries', {
      transactionId,
      entryCount: entries.length,
    });

    // Create all entries in a transaction
    const created = await prisma.$transaction(
      entries.map((entry) =>
        prisma.ledgerEntry.create({
          data: {
            transactionId: entry.transactionId,
            accountCode: entry.accountCode,
            entryType: entry.entryType,
            amount: entry.amount,
            currency: entry.currency,
            description: entry.description,
            metadata: (entry.metadata ?? {}) as object,
          },
        })
      )
    );

    logger.info('Ledger entries recorded', {
      transactionId,
      entryIds: created.map((e) => e.id),
    });

    return created.map((e) => this.toLedgerEntryResponse(e));
  }

  /**
   * Automatically generate ledger entries for a completed payment.
   */
  async recordPayment(
    transactionId: string,
    amount: bigint,
    currency: Currency,
    _merchantId: string
  ): Promise<LedgerEntryResponse[]> {
    const entries: CreateLedgerEntryRequest[] = [
      {
        transactionId,
        accountCode: AccountCode.CASH,
        entryType: 'DEBIT' as LedgerEntryType,
        amount,
        currency,
        description: 'Payment received from customer',
      },
      {
        transactionId,
        accountCode: AccountCode.MERCHANT_PAYABLE,
        entryType: 'CREDIT' as LedgerEntryType,
        amount,
        currency,
        description: 'Payable to merchant',
      },
    ];

    return this.recordEntries(transactionId, entries);
  }

  /**
   * Automatically generate ledger entries for a refund.
   */
  async recordRefund(
    transactionId: string,
    amount: bigint,
    currency: Currency,
    _merchantId: string
  ): Promise<LedgerEntryResponse[]> {
    const entries: CreateLedgerEntryRequest[] = [
      {
        transactionId,
        accountCode: AccountCode.REFUND_PAYABLE,
        entryType: 'DEBIT' as LedgerEntryType,
        amount,
        currency,
        description: `Refund issued to customer`,
      },
      {
        transactionId,
        accountCode: AccountCode.CASH,
        entryType: 'CREDIT' as LedgerEntryType,
        amount,
        currency,
        description: `Cash outflow for refund`,
      },
    ];

    return this.recordEntries(transactionId, entries);
  }

  /**
   * Automatically generate ledger entries for an FX conversion spread.
   */
  async recordFxSpread(
    transactionId: string,
    spreadAmount: bigint,
    currency: Currency
  ): Promise<LedgerEntryResponse[]> {
    const entries: CreateLedgerEntryRequest[] = [
      {
        transactionId,
        accountCode: AccountCode.FX_RECEIVABLE,
        entryType: 'DEBIT' as LedgerEntryType,
        amount: spreadAmount,
        currency,
        description: 'FX spread receivable',
      },
      {
        transactionId,
        accountCode: AccountCode.FX_REVENUE,
        entryType: 'CREDIT' as LedgerEntryType,
        amount: spreadAmount,
        currency,
        description: 'FX spread revenue',
      },
    ];

    return this.recordEntries(transactionId, entries);
  }

  /**
   * Get all ledger entries for a specific transaction.
   */
  async getEntriesByTransaction(transactionId: string): Promise<LedgerEntryResponse[]> {
    const entries = await prisma.ledgerEntry.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' },
    });

    return entries.map((e) => this.toLedgerEntryResponse(e));
  }

  /**
   * List ledger entries with filters and pagination.
   */
  async listEntries(filter: ListLedgerEntriesFilter): Promise<LedgerEntryListResponse> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LedgerEntryWhereInput = {};

    if (filter.transactionId) where.transactionId = filter.transactionId;
    if (filter.accountCode) where.accountCode = filter.accountCode;
    if (filter.entryType) where.entryType = filter.entryType;
    if (filter.currency) where.currency = filter.currency;
    if (filter.fromDate || filter.toDate) {
      where.createdAt = {};
      if (filter.fromDate) where.createdAt.gte = filter.fromDate;
      if (filter.toDate) where.createdAt.lte = filter.toDate;
    }

    const [entries, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ledgerEntry.count({ where }),
    ]);

    return {
      entries: entries.map((e) => this.toLedgerEntryResponse(e)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get the balance for a specific account, optionally filtered by currency.
   */
  async getAccountBalance(
    accountCode: string,
    currency?: Currency,
    asOf?: Date
  ): Promise<AccountBalance[]> {
    const where: Prisma.LedgerEntryWhereInput = { accountCode };
    if (currency) where.currency = currency;
    if (asOf) where.createdAt = { lte: asOf };

    const entries = await prisma.ledgerEntry.groupBy({
      by: ['currency', 'entryType'],
      where,
      _sum: { amount: true },
    });

    // Group by currency
    const balanceMap = new Map<Currency, { debitTotal: bigint; creditTotal: bigint }>();

    for (const entry of entries) {
      const cur = entry.currency;
      if (!balanceMap.has(cur)) {
        balanceMap.set(cur, { debitTotal: 0n, creditTotal: 0n });
      }
      const bal = balanceMap.get(cur)!;
      const sum = entry._sum.amount ?? 0n;
      if (entry.entryType === 'DEBIT') {
        bal.debitTotal += sum;
      } else {
        bal.creditTotal += sum;
      }
    }

    const balances: AccountBalance[] = [];
    for (const [cur, bal] of balanceMap) {
      balances.push({
        accountCode,
        currency: cur,
        debitTotal: bal.debitTotal,
        creditTotal: bal.creditTotal,
        balance: bal.debitTotal - bal.creditTotal,
      });
    }

    return balances;
  }

  /**
   * Get a full ledger summary across all accounts.
   */
  async getLedgerSummary(
    currency?: Currency,
    fromDate?: Date,
    toDate?: Date
  ): Promise<LedgerSummary> {
    const where: Prisma.LedgerEntryWhereInput = {};
    if (currency) where.currency = currency;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const entries = await prisma.ledgerEntry.groupBy({
      by: ['accountCode', 'currency', 'entryType'],
      where,
      _sum: { amount: true },
    });

    // Build account balances
    const accountMap = new Map<string, Map<Currency, { debitTotal: bigint; creditTotal: bigint }>>();
    let totalDebits = 0n;
    let totalCredits = 0n;

    for (const entry of entries) {
      const key = entry.accountCode;
      if (!accountMap.has(key)) {
        accountMap.set(key, new Map());
      }
      const currencyMap = accountMap.get(key)!;
      if (!currencyMap.has(entry.currency)) {
        currencyMap.set(entry.currency, { debitTotal: 0n, creditTotal: 0n });
      }
      const bal = currencyMap.get(entry.currency)!;
      const sum = entry._sum.amount ?? 0n;

      if (entry.entryType === 'DEBIT') {
        bal.debitTotal += sum;
        totalDebits += sum;
      } else {
        bal.creditTotal += sum;
        totalCredits += sum;
      }
    }

    const accounts: AccountBalance[] = [];
    for (const [code, currencyMap] of accountMap) {
      for (const [cur, bal] of currencyMap) {
        accounts.push({
          accountCode: code,
          currency: cur,
          debitTotal: bal.debitTotal,
          creditTotal: bal.creditTotal,
          balance: bal.debitTotal - bal.creditTotal,
        });
      }
    }

    return {
      totalDebits,
      totalCredits,
      isBalanced: totalDebits === totalCredits,
      accounts,
    };
  }

  private validateBalance(
    transactionId: string,
    entries: CreateLedgerEntryRequest[]
  ): void {
    // Group by currency and check balance
    const currencyTotals = new Map<Currency, { debits: bigint; credits: bigint }>();

    for (const entry of entries) {
      if (!currencyTotals.has(entry.currency)) {
        currencyTotals.set(entry.currency, { debits: 0n, credits: 0n });
      }
      const totals = currencyTotals.get(entry.currency)!;
      if (entry.entryType === 'DEBIT') {
        totals.debits += entry.amount;
      } else {
        totals.credits += entry.amount;
      }
    }

    for (const [, totals] of currencyTotals) {
      if (totals.debits !== totals.credits) {
        throw LedgerError.unbalancedEntry(transactionId);
      }
    }
  }

  private toLedgerEntryResponse(entry: {
    id: string;
    transactionId: string;
    accountCode: string;
    entryType: LedgerEntryType;
    amount: bigint;
    currency: Currency;
    balance: bigint | null;
    description: string | null;
    metadata: unknown;
    createdAt: Date;
  }): LedgerEntryResponse {
    return {
      id: entry.id,
      transactionId: entry.transactionId,
      accountCode: entry.accountCode,
      entryType: entry.entryType,
      amount: entry.amount,
      currency: entry.currency,
      balance: entry.balance,
      description: entry.description,
      metadata: entry.metadata as Record<string, unknown>,
      createdAt: entry.createdAt,
    };
  }
}

export const ledgerService = LedgerService.getInstance();
