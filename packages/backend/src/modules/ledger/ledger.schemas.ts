import { z } from 'zod';

const currencyEnum = z.enum([
  'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
]);

const ledgerEntryTypeEnum = z.enum(['DEBIT', 'CREDIT']);

export const createLedgerEntriesBodySchema = z.object({
  transactionId: z.string().uuid(),
  entries: z.array(z.object({
    accountCode: z.string().min(1).max(20),
    entryType: ledgerEntryTypeEnum,
    amount: z.coerce.bigint().positive('Amount must be positive'),
    currency: currencyEnum,
    description: z.string().max(500).optional(),
    metadata: z.record(z.unknown()).optional(),
  })).min(2, 'At least two entries required for double-entry bookkeeping'),
});

export const listLedgerEntriesQuerySchema = z.object({
  transactionId: z.string().uuid().optional(),
  accountCode: z.string().optional(),
  entryType: ledgerEntryTypeEnum.optional(),
  currency: currencyEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const accountCodeParamSchema = z.object({
  accountCode: z.string().min(1).max(20),
});

export const transactionIdParamSchema = z.object({
  transactionId: z.string().uuid(),
});

export const balanceQuerySchema = z.object({
  currency: currencyEnum.optional(),
  asOf: z.string().datetime().optional(),
});

export type CreateLedgerEntriesBody = z.infer<typeof createLedgerEntriesBodySchema>;
export type ListLedgerEntriesQuery = z.infer<typeof listLedgerEntriesQuerySchema>;
export type AccountCodeParam = z.infer<typeof accountCodeParamSchema>;
export type TransactionIdParam = z.infer<typeof transactionIdParamSchema>;
export type BalanceQuery = z.infer<typeof balanceQuerySchema>;
