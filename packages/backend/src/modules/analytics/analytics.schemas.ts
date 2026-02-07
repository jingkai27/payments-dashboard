import { z } from 'zod';

const currencyEnum = z.enum([
  'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
]);

export const historicalQuerySchema = z.object({
  granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']).default('daily'),
  currency: currencyEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(365).default(30),
});

export const providerHealthQuerySchema = z.object({
  granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']).default('daily'),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(14),
});

export type HistoricalQueryInput = z.infer<typeof historicalQuerySchema>;
export type ProviderHealthQueryInput = z.infer<typeof providerHealthQuerySchema>;
