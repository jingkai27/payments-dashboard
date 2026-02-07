import {
  RoutingContext,
  RoutingProviderInfo,
  ProviderScore,
  ScoringWeights,
  DEFAULT_SCORING_WEIGHTS,
} from '../routing.types.js';
import { providerService } from '../../provider/provider.service.js';
import { logger } from '../../../shared/utils/logger.js';

export class ProviderScoreEvaluator {
  private weights: ScoringWeights;

  constructor(weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS) {
    this.weights = weights;
  }

  async evaluateProviders(
    providers: RoutingProviderInfo[],
    context: RoutingContext
  ): Promise<ProviderScore[]> {
    const scores: ProviderScore[] = [];

    for (const provider of providers) {
      const score = await this.evaluateProvider(provider, context);
      scores.push(score);
    }

    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);

    return scores;
  }

  private async evaluateProvider(
    provider: RoutingProviderInfo,
    context: RoutingContext
  ): Promise<ProviderScore> {
    // Check basic eligibility first
    const eligibility = this.checkEligibility(provider, context);

    if (!eligibility.eligible) {
      return {
        providerId: provider.id,
        providerCode: provider.code,
        totalScore: 0,
        components: {
          successRate: 0,
          availability: 0,
          latency: 0,
          cost: 0,
          priority: 0,
        },
        eligible: false,
        disqualificationReason: eligibility.reason,
      };
    }

    // Get provider metrics
    const metrics = await this.getProviderMetrics(provider.id);

    // Calculate individual scores (0-100 scale)
    const successRateScore = this.calculateSuccessRateScore(
      metrics.successRate ?? provider.successRate ?? 0.95
    );
    const availabilityScore = this.calculateAvailabilityScore(provider.status);
    const latencyScore = this.calculateLatencyScore(
      metrics.averageLatency ?? provider.averageLatency ?? 200
    );
    const costScore = this.calculateCostScore(provider.costPerTransaction ?? 0);
    const priorityScore = this.calculatePriorityScore(provider.priority);

    // Calculate weighted total score
    const totalScore =
      successRateScore * this.weights.successRate +
      availabilityScore * this.weights.availability +
      latencyScore * this.weights.latency +
      costScore * this.weights.cost +
      priorityScore * this.weights.priority;

    logger.debug('Provider score calculated', {
      providerId: provider.id,
      providerCode: provider.code,
      totalScore,
      components: {
        successRate: successRateScore,
        availability: availabilityScore,
        latency: latencyScore,
        cost: costScore,
        priority: priorityScore,
      },
    });

    return {
      providerId: provider.id,
      providerCode: provider.code,
      totalScore,
      components: {
        successRate: successRateScore,
        availability: availabilityScore,
        latency: latencyScore,
        cost: costScore,
        priority: priorityScore,
      },
      eligible: true,
    };
  }

  private checkEligibility(
    provider: RoutingProviderInfo,
    context: RoutingContext
  ): { eligible: boolean; reason?: string } {
    // Check if provider is active
    if (!provider.isActive) {
      return { eligible: false, reason: 'Provider is inactive' };
    }

    // Check provider status
    if (provider.status === 'INACTIVE' || provider.status === 'MAINTENANCE') {
      return { eligible: false, reason: `Provider status is ${provider.status}` };
    }

    // Check currency support
    if (!provider.supportedCurrencies.includes(context.currency)) {
      return { eligible: false, reason: `Currency ${context.currency} not supported` };
    }

    // Check payment method support
    if (!provider.supportedMethods.includes(context.paymentMethodType)) {
      return {
        eligible: false,
        reason: `Payment method ${context.paymentMethodType} not supported`,
      };
    }

    return { eligible: true };
  }

  private async getProviderMetrics(
    providerId: string
  ): Promise<{ successRate?: number; averageLatency?: number }> {
    try {
      const metrics = await providerService.getMetrics(providerId);
      return {
        successRate: metrics?.successRate,
        averageLatency: metrics?.averageLatency,
      };
    } catch {
      return {};
    }
  }

  /**
   * Success rate score: 0.95 (95%) = 95 points, 0.80 (80%) = 80 points
   */
  private calculateSuccessRateScore(successRate: number): number {
    return Math.min(100, Math.max(0, successRate * 100));
  }

  /**
   * Availability score based on provider status
   * ACTIVE = 100, DEGRADED = 50, others = 0
   */
  private calculateAvailabilityScore(status: string): number {
    switch (status) {
      case 'ACTIVE':
        return 100;
      case 'DEGRADED':
        return 50;
      default:
        return 0;
    }
  }

  /**
   * Latency score: lower is better
   * < 100ms = 100, 100-300ms = 75-100, 300-500ms = 50-75, > 500ms = 0-50
   */
  private calculateLatencyScore(latencyMs: number): number {
    if (latencyMs < 100) return 100;
    if (latencyMs < 300) return 100 - ((latencyMs - 100) / 200) * 25;
    if (latencyMs < 500) return 75 - ((latencyMs - 300) / 200) * 25;
    if (latencyMs < 1000) return 50 - ((latencyMs - 500) / 500) * 50;
    return 0;
  }

  /**
   * Cost score: lower cost is better
   * Assumes cost is in percentage (e.g., 0.029 = 2.9%)
   */
  private calculateCostScore(cost: number): number {
    if (cost <= 0) return 100;
    if (cost <= 0.01) return 100 - cost * 1000;
    if (cost <= 0.03) return 90 - (cost - 0.01) * 2000;
    if (cost <= 0.05) return 50 - (cost - 0.03) * 1000;
    return Math.max(0, 30 - (cost - 0.05) * 500);
  }

  /**
   * Priority score: higher priority = higher score
   * Priority 1 = 100, Priority 10 = 10
   */
  private calculatePriorityScore(priority: number): number {
    return Math.max(0, 100 - (priority - 1) * 10);
  }
}

export const providerScoreEvaluator = new ProviderScoreEvaluator();
