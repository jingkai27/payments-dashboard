import { z } from 'zod';

const paymentMethodTypeEnum = z.enum([
  'CARD', 'BANK_TRANSFER', 'DIGITAL_WALLET', 'CRYPTO',
]);

export const createPaymentMethodBodySchema = z.object({
  customerId: z.string().uuid(),
  type: paymentMethodTypeEnum,
  token: z.string().optional(),
  cardNumber: z.string().min(13).max(19).optional(),
  expiryMonth: z.number().int().min(1).max(12).optional(),
  expiryYear: z.number().int().min(2024).max(2050).optional(),
  cvv: z.string().min(3).max(4).optional(),
  holderName: z.string().max(200).optional(),
  brand: z.string().max(50).optional(),
  bankName: z.string().max(200).optional(),
  walletProvider: z.string().max(50).optional(),
  isDefault: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export const updatePaymentMethodBodySchema = z.object({
  expiryMonth: z.number().int().min(1).max(12).optional(),
  expiryYear: z.number().int().min(2024).max(2050).optional(),
  holderName: z.string().max(200).optional(),
  isDefault: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const paymentMethodIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listPaymentMethodsQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  type: paymentMethodTypeEnum.optional(),
  isActive: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreatePaymentMethodBody = z.infer<typeof createPaymentMethodBodySchema>;
export type UpdatePaymentMethodBody = z.infer<typeof updatePaymentMethodBodySchema>;
export type PaymentMethodIdParam = z.infer<typeof paymentMethodIdParamSchema>;
export type ListPaymentMethodsQuery = z.infer<typeof listPaymentMethodsQuerySchema>;
