import { RoutingRule } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { cacheService } from '../../shared/cache/cache.service.js';
import { logger } from '../../shared/utils/logger.js';
import {
  RoutingContext,
  RoutingDecision,
  RoutingRuleConditions,
  RoutingRuleInfo,
  RoutingProviderInfo,
  CreateRoutingRuleInput,
  UpdateRoutingRuleInput,
} from './routing.types.js';
import { conditionEvaluator, providerScoreEvaluator } from './evaluators/index.js';

const RULES_CACHE_PREFIX = 'routing:rules:';
const RULES_CACHE_TTL = 300; // 5 minutes

export class RoutingService {
  private static instance: RoutingService | null = null;

  private constructor() {}

  static getInstance(): RoutingService {
    if (!RoutingService.instance) {
      RoutingService.instance = new RoutingService();
    }
    return RoutingService.instance;
  }

  async selectProvider(context: RoutingContext): Promise<RoutingDecision> {
    logger.debug('Selecting provider for routing context', {
      merchantId: context.merchantId,
      amount: context.amount.toString(),
      currency: context.currency,
    });

    // 1. Get merchant-specific routing rules
    const rules = await this.getRulesForMerchant(context.merchantId);

    // 2. Evaluate rules in priority order
    let matchedRule: RoutingRule | null = null;
    for (const rule of rules) {
      const conditions = rule.conditions as RoutingRuleConditions;
      if (conditionEvaluator.evaluate(conditions, context)) {
        matchedRule = rule;
        break;
      }
    }

    // 3. Get available providers for this merchant
    const providers = await this.getAvailableProviders(context.merchantId);

    if (providers.length === 0) {
      throw new Error('No providers available for this merchant');
    }

    // 4. If a rule matched, use that provider (if eligible)
    if (matchedRule) {
      const ruleProvider = providers.find((p) => p.id === matchedRule!.providerId);

      if (ruleProvider) {
        // Still score all providers for fallbacks
        const scores = await providerScoreEvaluator.evaluateProviders(providers, context);
        const eligibleProviders = scores.filter((s) => s.eligible && s.providerId !== matchedRule!.providerId);

        return {
          selectedProviderId: ruleProvider.id,
          selectedProviderCode: ruleProvider.code,
          fallbackProviderIds: eligibleProviders.slice(0, 2).map((s) => s.providerId),
          matchedRuleId: matchedRule.id,
          score: 100, // Rule-based selection
          reason: `Matched routing rule: ${matchedRule.name}`,
          evaluatedAt: new Date(),
        };
      }
    }

    // 5. Score-based selection
    const scores = await providerScoreEvaluator.evaluateProviders(providers, context);
    const eligibleProviders = scores.filter((s) => s.eligible);

    if (eligibleProviders.length === 0) {
      throw new Error('No eligible providers for this transaction');
    }

    const selected = eligibleProviders[0]!;
    const fallbacks = eligibleProviders.slice(1, 3);

    return {
      selectedProviderId: selected.providerId,
      selectedProviderCode: selected.providerCode,
      fallbackProviderIds: fallbacks.map((s) => s.providerId),
      score: selected.totalScore,
      reason: 'Selected by scoring algorithm',
      evaluatedAt: new Date(),
    };
  }

  async getNextFallback(
    context: RoutingContext,
    failedProviderIds: string[]
  ): Promise<RoutingDecision | null> {
    logger.debug('Getting next fallback provider', {
      merchantId: context.merchantId,
      failedProviderIds,
    });

    const providers = await this.getAvailableProviders(context.merchantId);
    const remainingProviders = providers.filter(
      (p) => !failedProviderIds.includes(p.id)
    );

    if (remainingProviders.length === 0) {
      return null;
    }

    const scores = await providerScoreEvaluator.evaluateProviders(remainingProviders, context);
    const eligibleProviders = scores.filter((s) => s.eligible);

    if (eligibleProviders.length === 0) {
      return null;
    }

    const selected = eligibleProviders[0]!;
    const fallbacks = eligibleProviders.slice(1, 3);

    return {
      selectedProviderId: selected.providerId,
      selectedProviderCode: selected.providerCode,
      fallbackProviderIds: fallbacks.map((s) => s.providerId),
      score: selected.totalScore,
      reason: `Fallback after ${failedProviderIds.length} failures`,
      evaluatedAt: new Date(),
    };
  }

  async evaluateRule(
    rule: RoutingRuleInfo,
    context: RoutingContext
  ): Promise<boolean> {
    return conditionEvaluator.evaluate(rule.conditions, context);
  }

  // Rule Management

  async listRules(
    merchantId: string,
    options?: { isActive?: boolean; page?: number; limit?: number }
  ): Promise<{ rules: RoutingRuleInfo[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      merchantId,
      ...(options?.isActive !== undefined ? { isActive: options.isActive } : {}),
    };

    const [rules, total] = await Promise.all([
      prisma.routingRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { priority: 'asc' },
      }),
      prisma.routingRule.count({ where }),
    ]);

    return {
      rules: rules.map((r) => this.toRuleInfo(r)),
      total,
    };
  }

  async getRule(id: string): Promise<RoutingRuleInfo | null> {
    const rule = await prisma.routingRule.findUnique({
      where: { id },
    });

    return rule ? this.toRuleInfo(rule) : null;
  }

  async createRule(input: CreateRoutingRuleInput): Promise<RoutingRuleInfo> {
    const rule = await prisma.routingRule.create({
      data: {
        merchantId: input.merchantId,
        name: input.name,
        description: input.description,
        conditions: input.conditions as object,
        providerId: input.providerId,
        priority: input.priority,
        isActive: input.isActive ?? true,
      },
    });

    // Invalidate cache
    await this.invalidateRulesCache(input.merchantId);

    logger.info('Created routing rule', { ruleId: rule.id, merchantId: input.merchantId });

    return this.toRuleInfo(rule);
  }

  async updateRule(
    id: string,
    input: UpdateRoutingRuleInput
  ): Promise<RoutingRuleInfo | null> {
    const existing = await prisma.routingRule.findUnique({
      where: { id },
    });

    if (!existing) {
      return null;
    }

    const rule = await prisma.routingRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.conditions !== undefined ? { conditions: input.conditions as object } : {}),
        ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    // Invalidate cache
    await this.invalidateRulesCache(existing.merchantId);

    logger.info('Updated routing rule', { ruleId: id });

    return this.toRuleInfo(rule);
  }

  async deleteRule(id: string): Promise<boolean> {
    const existing = await prisma.routingRule.findUnique({
      where: { id },
    });

    if (!existing) {
      return false;
    }

    await prisma.routingRule.delete({
      where: { id },
    });

    // Invalidate cache
    await this.invalidateRulesCache(existing.merchantId);

    logger.info('Deleted routing rule', { ruleId: id });

    return true;
  }

  // Private helpers

  private async getRulesForMerchant(merchantId: string): Promise<RoutingRule[]> {
    const cacheKey = `${RULES_CACHE_PREFIX}${merchantId}`;
    const cached = await cacheService.get<RoutingRule[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const rules = await prisma.routingRule.findMany({
      where: {
        merchantId,
        isActive: true,
      },
      orderBy: { priority: 'asc' },
    });

    await cacheService.setWithTTL(cacheKey, rules, RULES_CACHE_TTL);

    return rules;
  }

  private async getAvailableProviders(
    merchantId: string
  ): Promise<RoutingProviderInfo[]> {
    // Get providers configured for this merchant
    const configs = await prisma.merchantProviderConfig.findMany({
      where: {
        merchantId,
        isActive: true,
      },
      include: {
        provider: true,
      },
      orderBy: { priority: 'asc' },
    });

    return configs.map((config) => ({
      id: config.provider.id,
      code: config.provider.code,
      name: config.provider.name,
      status: config.provider.status,
      supportedCurrencies: config.provider.supportedCurrencies,
      supportedMethods: config.provider.supportedMethods,
      priority: config.priority,
      isActive: config.provider.isActive,
    }));
  }

  private async invalidateRulesCache(merchantId: string): Promise<void> {
    await cacheService.delete(`${RULES_CACHE_PREFIX}${merchantId}`);
  }

  private toRuleInfo(rule: RoutingRule): RoutingRuleInfo {
    return {
      id: rule.id,
      merchantId: rule.merchantId,
      name: rule.name,
      description: rule.description ?? undefined,
      conditions: rule.conditions as RoutingRuleConditions,
      providerId: rule.providerId,
      priority: rule.priority,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}

export const routingService = RoutingService.getInstance();
