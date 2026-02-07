import { z } from 'zod';

const currencyEnum = z.enum([
  'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
]);

export const mockSettlementQuerySchema = z.object({
  merchantId: z.string().uuid(),
  providerId: z.string().uuid(),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  format: z.enum(['json', 'csv']).default('json'),
  introduceDiscrepancies: z.coerce.boolean().default(false),
});

const settlementRecordSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.number().int(),
  currency: currencyEnum,
  status: z.string(),
  providerRef: z.string().optional(),
  settledAt: z.string().optional(),
});

export const reconcileBodySchema = z.object({
  merchantId: z.string().uuid(),
  providerId: z.string().uuid(),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  settlementData: z.array(settlementRecordSchema).min(1),
});

export const listReportsQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const reportIdParamSchema = z.object({
  reportId: z.string().uuid(),
});

export const resolveDiscrepancyBodySchema = z.object({
  discrepancyId: z.string(),
  resolution: z.enum(['force_match', 'refund', 'ignore']),
  resolvedBy: z.string().optional(),
});

export type MockSettlementQuery = z.infer<typeof mockSettlementQuerySchema>;
export type ReconcileBody = z.infer<typeof reconcileBodySchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type ReportIdParam = z.infer<typeof reportIdParamSchema>;
export type ResolveDiscrepancyBody = z.infer<typeof resolveDiscrepancyBodySchema>;
