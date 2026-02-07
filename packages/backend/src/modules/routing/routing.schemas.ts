import { z } from 'zod';

const currencyEnum = z.enum([
  'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
]);

const paymentMethodTypeEnum = z.enum([
  'CARD', 'BANK_TRANSFER', 'DIGITAL_WALLET', 'CRYPTO',
]);

const conditionOperatorEnum = z.enum([
  'equals', 'not_equals', 'in', 'not_in',
  'greater_than', 'less_than', 'greater_than_or_equals', 'less_than_or_equals',
  'between', 'contains', 'starts_with', 'ends_with',
]);

const ruleConditionSchema = z.object({
  field: z.string(),
  operator: conditionOperatorEnum,
  value: z.unknown(),
});

const routingRuleConditionsSchema = z.object({
  currency: ruleConditionSchema.optional(),
  amount: ruleConditionSchema.optional(),
  paymentMethodType: ruleConditionSchema.optional(),
  cardBrand: ruleConditionSchema.optional(),
  country: ruleConditionSchema.optional(),
  region: ruleConditionSchema.optional(),
  all: z.array(ruleConditionSchema).optional(),
  any: z.array(ruleConditionSchema).optional(),
});

export const routingPreviewBodySchema = z.object({
  merchantId: z.string().uuid(),
  amount: z.coerce.bigint().positive(),
  currency: currencyEnum,
  paymentMethodType: paymentMethodTypeEnum.default('CARD'),
  cardBrand: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  customerId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listRulesQuerySchema = z.object({
  merchantId: z.string().uuid(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createRuleBodySchema = z.object({
  merchantId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  conditions: routingRuleConditionsSchema,
  providerId: z.string().uuid(),
  priority: z.number().int().min(1).max(1000).default(100),
  isActive: z.boolean().default(true),
});

export const updateRuleBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  conditions: routingRuleConditionsSchema.optional(),
  providerId: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
});

export const ruleIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type RoutingPreviewBody = z.infer<typeof routingPreviewBodySchema>;
export type ListRulesQuery = z.infer<typeof listRulesQuerySchema>;
export type CreateRuleBody = z.infer<typeof createRuleBodySchema>;
export type UpdateRuleBody = z.infer<typeof updateRuleBodySchema>;
export type RuleIdParam = z.infer<typeof ruleIdParamSchema>;
