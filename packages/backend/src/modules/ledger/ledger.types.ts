import { Currency, LedgerEntryType } from '@prisma/client';

// Standard account codes for double-entry bookkeeping
export enum AccountCode {
  // Asset accounts (1xxx)
  CASH = '1000',
  ACCOUNTS_RECEIVABLE = '1100',
  PROVIDER_RECEIVABLE = '1200',
  FX_RECEIVABLE = '1300',

  // Liability accounts (2xxx)
  ACCOUNTS_PAYABLE = '2000',
  MERCHANT_PAYABLE = '2100',
  REFUND_PAYABLE = '2200',

  // Revenue accounts (3xxx)
  PAYMENT_REVENUE = '3000',
  FX_REVENUE = '3100',
  FEE_REVENUE = '3200',

  // Expense accounts (4xxx)
  PROVIDER_FEES = '4000',
  FX_COSTS = '4100',
  REFUND_EXPENSE = '4200',
}

export interface CreateLedgerEntryRequest {
  transactionId: string;
  accountCode: string;
  entryType: LedgerEntryType;
  amount: bigint;
  currency: Currency;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface LedgerEntryResponse {
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
}

export interface AccountBalance {
  accountCode: string;
  currency: Currency;
  debitTotal: bigint;
  creditTotal: bigint;
  balance: bigint;
}

export interface LedgerSummary {
  totalDebits: bigint;
  totalCredits: bigint;
  isBalanced: boolean;
  accounts: AccountBalance[];
}

export interface ListLedgerEntriesFilter {
  transactionId?: string;
  accountCode?: string;
  entryType?: LedgerEntryType;
  currency?: Currency;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

export interface LedgerEntryListResponse {
  entries: LedgerEntryResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class LedgerError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
  }

  static unbalancedEntry(transactionId: string): LedgerError {
    return new LedgerError(
      `Ledger entries for transaction ${transactionId} are not balanced`,
      'UNBALANCED_ENTRY'
    );
  }

  static invalidAccountCode(code: string): LedgerError {
    return new LedgerError(
      `Invalid account code: ${code}`,
      'INVALID_ACCOUNT_CODE'
    );
  }

  static transactionNotFound(transactionId: string): LedgerError {
    return new LedgerError(
      `Transaction ${transactionId} not found`,
      'TRANSACTION_NOT_FOUND'
    );
  }

  static duplicateEntry(transactionId: string): LedgerError {
    return new LedgerError(
      `Ledger entries already exist for transaction ${transactionId}`,
      'DUPLICATE_ENTRY'
    );
  }
}
