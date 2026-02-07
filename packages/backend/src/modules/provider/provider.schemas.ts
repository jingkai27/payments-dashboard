import { z } from 'zod';

export const providerIdParamSchema = z.object({
  id: z.string().uuid('Invalid provider ID'),
});

export const listProvidersQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DEGRADED']).optional(),
  currency: z.string().optional(),
  method: z.enum(['CARD', 'BANK_TRANSFER', 'DIGITAL_WALLET', 'CRYPTO']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const providerHealthResponseSchema = z.object({
  providerId: z.string().uuid(),
  providerCode: z.string(),
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  latency: z.number(),
  lastCheck: z.string().datetime(),
  message: z.string().optional(),
  metrics: z
    .object({
      successRate: z.number(),
      averageLatency: z.number(),
      totalTransactions: z.number(),
      failedTransactions: z.number(),
      lastUpdated: z.string().datetime(),
    })
    .optional(),
});

export type ProviderIdParam = z.infer<typeof providerIdParamSchema>;
export type ListProvidersQuery = z.infer<typeof listProvidersQuerySchema>;
export type ProviderHealthResponse = z.infer<typeof providerHealthResponseSchema>;
