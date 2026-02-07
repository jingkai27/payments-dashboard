import { Request, Response, NextFunction } from 'express';
import { ledgerService } from './ledger.service.js';
import {
  CreateLedgerEntriesBody,
  ListLedgerEntriesQuery,
  AccountCodeParam,
  TransactionIdParam,
  BalanceQuery,
} from './ledger.schemas.js';
import { AppError } from '../../shared/errors/app-error.js';
import { Currency, LedgerEntryType } from '@prisma/client';

export class LedgerController {
  async createEntries(
    req: Request<unknown, unknown, CreateLedgerEntriesBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { transactionId, entries } = req.body;

      const ledgerEntries = await ledgerService.recordEntries(
        transactionId,
        entries.map((e) => ({
          transactionId,
          accountCode: e.accountCode,
          entryType: e.entryType as LedgerEntryType,
          amount: e.amount,
          currency: e.currency as Currency,
          description: e.description,
          metadata: e.metadata,
        }))
      );

      res.status(201).json({
        success: true,
        data: ledgerEntries.map((e) => this.formatEntryResponse(e)),
      });
    } catch (error) {
      next(error);
    }
  }

  async listEntries(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ListLedgerEntriesQuery;

      const result = await ledgerService.listEntries({
        transactionId: query.transactionId,
        accountCode: query.accountCode,
        entryType: query.entryType as LedgerEntryType | undefined,
        currency: query.currency as Currency | undefined,
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
        page: query.page,
        limit: query.limit,
      });

      res.json({
        success: true,
        data: result.entries.map((e) => this.formatEntryResponse(e)),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEntriesByTransaction(
    req: Request<TransactionIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { transactionId } = req.params;

      const entries = await ledgerService.getEntriesByTransaction(transactionId);

      if (entries.length === 0) {
        throw AppError.notFound(`No ledger entries found for transaction ${transactionId}`);
      }

      res.json({
        success: true,
        data: entries.map((e) => this.formatEntryResponse(e)),
      });
    } catch (error) {
      next(error);
    }
  }

  async getAccountBalance(
    req: Request<AccountCodeParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { accountCode } = req.params;
      const query = req.query as unknown as BalanceQuery;

      const balances = await ledgerService.getAccountBalance(
        accountCode,
        query.currency as Currency | undefined,
        query.asOf ? new Date(query.asOf) : undefined
      );

      res.json({
        success: true,
        data: balances.map((b) => ({
          accountCode: b.accountCode,
          currency: b.currency,
          debitTotal: b.debitTotal.toString(),
          creditTotal: b.creditTotal.toString(),
          balance: b.balance.toString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as BalanceQuery & {
        fromDate?: string;
        toDate?: string;
      };

      const summary = await ledgerService.getLedgerSummary(
        query.currency as Currency | undefined,
        query.fromDate ? new Date(query.fromDate) : undefined,
        query.toDate ? new Date(query.toDate) : undefined
      );

      res.json({
        success: true,
        data: {
          totalDebits: summary.totalDebits.toString(),
          totalCredits: summary.totalCredits.toString(),
          isBalanced: summary.isBalanced,
          accounts: summary.accounts.map((a) => ({
            accountCode: a.accountCode,
            currency: a.currency,
            debitTotal: a.debitTotal.toString(),
            creditTotal: a.creditTotal.toString(),
            balance: a.balance.toString(),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private formatEntryResponse(entry: {
    id: string;
    transactionId: string;
    accountCode: string;
    entryType: LedgerEntryType;
    amount: bigint;
    currency: Currency;
    balance: bigint | null;
    description: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
  }) {
    return {
      id: entry.id,
      transactionId: entry.transactionId,
      accountCode: entry.accountCode,
      entryType: entry.entryType,
      amount: entry.amount.toString(),
      currency: entry.currency,
      balance: entry.balance?.toString() ?? null,
      description: entry.description,
      metadata: entry.metadata,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}

export const ledgerController = new LedgerController();
