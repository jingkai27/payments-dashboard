import { z } from 'zod';

const currencyEnum = z.enum([
  'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
]);

export const fraudCheckBodySchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.number().int().positive(),
  currency: currencyEnum,
  ip: z.string().optional(),
  merchantId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const flaggedTransactionsQuerySchema = z.object({
  status: z.string().optional(),
  minRiskScore: z.coerce.number().int().min(0).max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const fraudReviewBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
  reviewedBy: z.string().optional(),
});

export const transactionIdParamSchema = z.object({
  transactionId: z.string().uuid(),
});

export type FraudCheckBody = z.infer<typeof fraudCheckBodySchema>;
export type FlaggedTransactionsQuery = z.infer<typeof flaggedTransactionsQuerySchema>;
export type FraudReviewBody = z.infer<typeof fraudReviewBodySchema>;
export type TransactionIdParam = z.infer<typeof transactionIdParamSchema>;
