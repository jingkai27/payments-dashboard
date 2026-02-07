import { z } from 'zod';

const currencyEnum = z.enum([
  'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
]);

const paymentMethodTypeEnum = z.enum([
  'CARD', 'BANK_TRANSFER', 'DIGITAL_WALLET', 'CRYPTO',
]);

const transactionStatusEnum = z.enum([
  'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED',
]);

const transactionTypeEnum = z.enum([
  'PAYMENT', 'REFUND', 'PAYOUT', 'TRANSFER',
]);

export const createPaymentBodySchema = z.object({
  merchantId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  amount: z.coerce.bigint().positive('Amount must be positive'),
  currency: currencyEnum,
  targetCurrency: currencyEnum.optional(),
  paymentMethod: z.object({
    type: paymentMethodTypeEnum,
    token: z.string().optional(),
    cardNumber: z.string().min(13).max(19).optional(),
    expiryMonth: z.number().int().min(1).max(12).optional(),
    expiryYear: z.number().int().min(2024).max(2050).optional(),
    cvv: z.string().min(3).max(4).optional(),
    holderName: z.string().optional(),
  }),
  capture: z.boolean().default(true),
  description: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().max(64).optional(),
});

export const paymentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listPaymentsQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: transactionStatusEnum.optional(),
  type: transactionTypeEnum.optional(),
  currency: currencyEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const capturePaymentBodySchema = z.object({
  amount: z.coerce.bigint().positive().optional(),
});

export const refundPaymentBodySchema = z.object({
  amount: z.coerce.bigint().positive().optional(),
  reason: z.string().max(500).optional(),
});

export const cancelPaymentBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>;
export type PaymentIdParam = z.infer<typeof paymentIdParamSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type CapturePaymentBody = z.infer<typeof capturePaymentBodySchema>;
export type RefundPaymentBody = z.infer<typeof refundPaymentBodySchema>;
export type CancelPaymentBody = z.infer<typeof cancelPaymentBodySchema>;
