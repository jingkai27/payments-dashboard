import { z } from 'zod';

const currencyEnum = z.enum([
  'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
]);

export const getRateQuerySchema = z.object({
  source: currencyEnum,
  target: currencyEnum,
});

export const getAllRatesQuerySchema = z.object({
  base: currencyEnum.default('USD'),
});

export const convertBodySchema = z.object({
  amount: z.coerce.bigint().positive('Amount must be positive'),
  sourceCurrency: currencyEnum,
  targetCurrency: currencyEnum,
});

export const quoteBodySchema = z.object({
  amount: z.coerce.bigint().positive('Amount must be positive'),
  sourceCurrency: currencyEnum,
  targetCurrency: currencyEnum,
  validityMinutes: z.number().int().positive().max(60).optional().default(15),
});

export const refreshRatesBodySchema = z.object({
  baseCurrency: currencyEnum.optional().default('USD'),
}).optional();

export type GetRateQuery = z.infer<typeof getRateQuerySchema>;
export type GetAllRatesQuery = z.infer<typeof getAllRatesQuerySchema>;
export type ConvertBody = z.infer<typeof convertBodySchema>;
export type QuoteBody = z.infer<typeof quoteBodySchema>;
export type RefreshRatesBody = z.infer<typeof refreshRatesBodySchema>;
