import { Currency, PaymentMethodType, ProviderStatus } from '@prisma/client';

// ============================================
// ROUTING CONTEXT
// ============================================

export interface RoutingContext {
  merchantId: string;
  amount: bigint;
  currency: Currency;
  paymentMethodType: PaymentMethodType;
  cardBrand?: string;
  country?: string;
  region?: string;
  customerId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// ROUTING DECISION
// ============================================

export interface RoutingDecision {
  selectedProviderId: string;
  selectedProviderCode: string;
  fallbackProviderIds: string[];
  matchedRuleId?: string;
  score: number;
  reason: string;
  evaluatedAt: Date;
}

// ============================================
// CONDITION TYPES
// ============================================

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equals'
  | 'less_than_or_equals'
  | 'between'
  | 'contains'
  | 'starts_with'
  | 'ends_with';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface RoutingRuleConditions {
  currency?: RuleCondition;
  amount?: RuleCondition;
  paymentMethodType?: RuleCondition;
  cardBrand?: RuleCondition;
  country?: RuleCondition;
  region?: RuleCondition;
  all?: RuleCondition[];
  any?: RuleCondition[];
}

// ============================================
// PROVIDER SCORING
// ============================================

export interface ProviderScore {
  providerId: string;
  providerCode: string;
  totalScore: number;
  components: {
    successRate: number;
    availability: number;
    latency: number;
    cost: number;
    priority: number;
  };
  eligible: boolean;
  disqualificationReason?: string;
}

export interface ScoringWeights {
  successRate: number;
  availability: number;
  latency: number;
  cost: number;
  priority: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  successRate: 0.40,
  availability: 0.25,
  latency: 0.15,
  cost: 0.10,
  priority: 0.10,
};

// ============================================
// PROVIDER INFO FOR ROUTING
// ============================================

export interface RoutingProviderInfo {
  id: string;
  code: string;
  name: string;
  status: ProviderStatus;
  supportedCurrencies: Currency[];
  supportedMethods: PaymentMethodType[];
  priority: number;
  successRate?: number;
  averageLatency?: number;
  costPerTransaction?: number;
  isActive: boolean;
}

// ============================================
// RULE MANAGEMENT
// ============================================

export interface CreateRoutingRuleInput {
  merchantId: string;
  name: string;
  description?: string;
  conditions: RoutingRuleConditions;
  providerId: string;
  priority: number;
  isActive?: boolean;
}

export interface UpdateRoutingRuleInput {
  name?: string;
  description?: string;
  conditions?: RoutingRuleConditions;
  providerId?: string;
  priority?: number;
  isActive?: boolean;
}

export interface RoutingRuleInfo {
  id: string;
  merchantId: string;
  name: string;
  description?: string;
  conditions: RoutingRuleConditions;
  providerId: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
