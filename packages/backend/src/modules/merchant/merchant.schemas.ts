import { z } from 'zod';

const currencyEnum = z.enum([
  'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
]);

export const createMerchantBodySchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().min(1).max(500),
  email: z.string().email(),
  defaultCurrency: currencyEnum.default('USD'),
  settings: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateMerchantBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().min(1).max(500).optional(),
  email: z.string().email().optional(),
  defaultCurrency: currencyEnum.optional(),
  settings: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const merchantIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listMerchantsQuerySchema = z.object({
  isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createCustomerBodySchema = z.object({
  merchantId: z.string().uuid(),
  externalId: z.string().max(200).optional(),
  email: z.string().email().optional(),
  name: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateCustomerBodySchema = z.object({
  email: z.string().email().optional(),
  name: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const customerIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listCustomersQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateMerchantBody = z.infer<typeof createMerchantBodySchema>;
export type UpdateMerchantBody = z.infer<typeof updateMerchantBodySchema>;
export type MerchantIdParam = z.infer<typeof merchantIdParamSchema>;
export type ListMerchantsQuery = z.infer<typeof listMerchantsQuerySchema>;
export type CreateCustomerBody = z.infer<typeof createCustomerBodySchema>;
export type UpdateCustomerBody = z.infer<typeof updateCustomerBodySchema>;
export type CustomerIdParam = z.infer<typeof customerIdParamSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
