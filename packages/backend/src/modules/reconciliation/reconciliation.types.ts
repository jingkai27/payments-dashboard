export type DiscrepancyType =
  | 'MISSING_IN_DB'
  | 'MISSING_IN_PROVIDER'
  | 'AMOUNT_MISMATCH'
  | 'STATUS_MISMATCH';

export type DiscrepancyResolution = 'force_match' | 'refund' | 'ignore';

export interface SettlementRecord {
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  providerRef?: string;
  settledAt?: string;
}

export interface MockSettlementRequest {
  merchantId: string;
  providerId: string;
  fromDate: string;
  toDate: string;
  format?: 'json' | 'csv';
  introduceDiscrepancies?: boolean;
}

export interface Discrepancy {
  id: string;
  transactionId: string;
  type: DiscrepancyType;
  providerAmount?: number;
  localAmount?: number;
  providerStatus?: string;
  localStatus?: string;
  description: string;
  resolution?: DiscrepancyResolution;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface ReconcileRequest {
  merchantId: string;
  providerId: string;
  fromDate: string;
  toDate: string;
  settlementData: SettlementRecord[];
}

export interface ReconciliationReportSummary {
  id: string;
  merchantId: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  totalTransactions: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  discrepancyCount: number;
  createdAt: string;
}

export interface ReconciliationReportDetail extends ReconciliationReportSummary {
  discrepancies: Discrepancy[];
  summary: Record<string, unknown>;
}
