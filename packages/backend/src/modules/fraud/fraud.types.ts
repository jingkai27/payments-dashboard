export interface FraudCheckRequest {
  transactionId: string;
  amount: number;
  currency: string;
  ip?: string;
  merchantId?: string;
  customerId?: string;
  metadata?: Record<string, unknown>;
}

export interface FraudFlag {
  rule: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  triggeredAt: string;
}

export interface FraudCheckResult {
  transactionId: string;
  riskScore: number;
  isFlagged: boolean;
  flags: FraudFlag[];
  checkedAt: string;
}

export type FraudReviewAction = 'approve' | 'reject';

export interface FraudReviewRequest {
  action: FraudReviewAction;
  reason?: string;
  reviewedBy?: string;
}

export interface FlaggedTransaction {
  id: string;
  transactionId: string;
  amount: string;
  currency: string;
  status: string;
  riskScore: number;
  flags: FraudFlag[];
  createdAt: string;
}

export interface FlaggedTransactionsFilter {
  status?: string;
  minRiskScore?: number;
  page?: number;
  limit?: number;
}
