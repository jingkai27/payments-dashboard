// Shared types for the frontend application

export type Currency = 'USD' | 'EUR' | 'GBP' | 'SGD' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'CNY' | 'HKD';

export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'CANCELLED';

export type TransactionType = 'PAYMENT' | 'REFUND' | 'PAYOUT' | 'TRANSFER';

export type PaymentMethodType = 'CARD' | 'BANK_TRANSFER' | 'DIGITAL_WALLET' | 'CRYPTO';

export type ProviderStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DEGRADED';

export interface Merchant {
  id: string;
  name: string;
  legalName: string;
  email: string;
  defaultCurrency: Currency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProvider {
  id: string;
  name: string;
  code: string;
  status: ProviderStatus;
  supportedCurrencies: Currency[];
  supportedMethods: PaymentMethodType[];
  isActive: boolean;
}

export interface Transaction {
  id: string;
  merchantId: string;
  customerId?: string;
  providerId?: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: Currency;
  convertedAmount?: number;
  convertedCurrency?: Currency;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Analytics types
export interface RealTimeStats {
  totalTransactions: number;
  successRate: number;
  volumeByCurrency: Record<string, number>;
  transactionsPerMinute: number;
  activeProviders: number;
}

export interface HistoricalDataPoint {
  period: string;
  successCount: number;
  failureCount: number;
  totalCount: number;
  totalVolume: string;
  avgAmount: string;
}

export interface ProviderHealthData {
  providerId: string;
  providerName: string;
  providerCode: string;
  totalTransactions: number;
  successCount: number;
  failureCount: number;
  errorRate: number;
  avgLatencyMs: number;
  dataPoints: { period: string; successCount: number; failureCount: number; errorRate: number }[];
}

// Reconciliation types
export type ReconciliationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'REQUIRES_REVIEW';

export type DiscrepancyType = 'MISSING_IN_DB' | 'MISSING_IN_PROVIDER' | 'AMOUNT_MISMATCH' | 'STATUS_MISMATCH';

export interface Discrepancy {
  id: string;
  transactionId: string;
  type: DiscrepancyType;
  providerAmount?: number;
  localAmount?: number;
  providerStatus?: string;
  localStatus?: string;
  description: string;
  resolution?: 'force_match' | 'refund' | 'ignore';
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ReconciliationSummary {
  id: string;
  merchantId: string;
  status: ReconciliationStatus;
  periodStart: string;
  periodEnd: string;
  totalTransactions: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  discrepancyCount: number;
  createdAt: string;
}

export interface ReconciliationReport extends ReconciliationSummary {
  discrepancies: Discrepancy[];
  summary: Record<string, unknown>;
}

export interface SettlementRecord {
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  providerRef?: string;
  settledAt?: string;
}
