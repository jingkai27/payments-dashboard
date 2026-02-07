import { PaymentProvider, ProviderStatus, Currency, PaymentMethodType, Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { cacheService } from '../../shared/cache/cache.service.js';
import { AdapterFactory, IPaymentProviderAdapter } from './adapters/index.js';
import { ProviderHealth, ProviderMetrics, ProviderInfo, ProviderConfig } from './provider.types.js';
import { logger } from '../../shared/utils/logger.js';
import { config } from '../../config/index.js';

const HEALTH_CACHE_TTL = 60; // 1 minute
const METRICS_CACHE_TTL = 300; // 5 minutes
const HEALTH_CACHE_PREFIX = 'provider:health:';
const METRICS_CACHE_PREFIX = 'provider:metrics:';

export class ProviderService {
  private static instance: ProviderService | null = null;

  private constructor() {}

  static getInstance(): ProviderService {
    if (!ProviderService.instance) {
      ProviderService.instance = new ProviderService();
    }
    return ProviderService.instance;
  }

  async getAdapter(providerCode: string, merchantId?: string): Promise<IPaymentProviderAdapter> {
    const providerConfig = await this.getProviderConfig(providerCode, merchantId);
    return AdapterFactory.getAdapter(providerCode, providerConfig);
  }

  async getProviderConfig(providerCode: string, merchantId?: string): Promise<ProviderConfig> {
    const provider = await prisma.paymentProvider.findUnique({
      where: { code: providerCode },
    });

    if (!provider) {
      throw new Error(`Provider ${providerCode} not found`);
    }

    let credentials: Record<string, unknown> = {};

    if (merchantId) {
      const merchantConfig = await prisma.merchantProviderConfig.findUnique({
        where: {
          merchantId_providerId: {
            merchantId,
            providerId: provider.id,
          },
        },
      });

      if (merchantConfig) {
        credentials = merchantConfig.credentials as Record<string, unknown>;
      }
    }

    const simulateLatencyMs = config.env.PROVIDER_SIMULATE_LATENCY_MS ?? 100;
    const failureRate = config.env.PROVIDER_FAILURE_RATE ?? 0.02;

    return {
      apiKey: credentials.apiKey as string | undefined,
      secretKey: credentials.secretKey as string | undefined,
      webhookSecret: credentials.webhookSecret as string | undefined,
      sandbox: config.isDevelopment,
      baseUrl: provider.baseUrl ?? undefined,
      timeout: 30000,
      metadata: {
        simulateLatencyMs,
        failureRate,
        ...(provider.config as Record<string, unknown>),
      },
    };
  }

  async listProviders(options?: {
    status?: ProviderStatus;
    currency?: Currency;
    method?: PaymentMethodType;
    page?: number;
    limit?: number;
  }): Promise<{ providers: ProviderInfo[]; total: number }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentProviderWhereInput = {
      isActive: true,
    };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.currency) {
      where.supportedCurrencies = {
        has: options.currency,
      };
    }

    if (options?.method) {
      where.supportedMethods = {
        has: options.method,
      };
    }

    const [providers, total] = await Promise.all([
      prisma.paymentProvider.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.paymentProvider.count({ where }),
    ]);

    const providerInfos = await Promise.all(
      providers.map(async (p) => this.toProviderInfo(p))
    );

    return { providers: providerInfos, total };
  }

  async getProvider(id: string): Promise<ProviderInfo | null> {
    const provider = await prisma.paymentProvider.findUnique({
      where: { id },
    });

    if (!provider) {
      return null;
    }

    return this.toProviderInfo(provider);
  }

  async getProviderByCode(code: string): Promise<ProviderInfo | null> {
    const provider = await prisma.paymentProvider.findUnique({
      where: { code },
    });

    if (!provider) {
      return null;
    }

    return this.toProviderInfo(provider);
  }

  async checkHealth(providerId: string): Promise<ProviderHealth> {
    // Check cache first
    const cached = await cacheService.get<ProviderHealth>(
      `${HEALTH_CACHE_PREFIX}${providerId}`
    );

    if (cached) {
      return cached;
    }

    const provider = await prisma.paymentProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    try {
      const adapter = await this.getAdapter(provider.code);
      const health = await adapter.checkHealth();

      // Cache the result
      await cacheService.setWithTTL(
        `${HEALTH_CACHE_PREFIX}${providerId}`,
        health,
        HEALTH_CACHE_TTL
      );

      // Update provider status based on health
      await this.updateProviderStatus(provider.id, health);

      return health;
    } catch (error) {
      const health: ProviderHealth = {
        status: 'unhealthy',
        latency: 0,
        lastCheck: new Date(),
        message: (error as Error).message,
      };

      await cacheService.setWithTTL(
        `${HEALTH_CACHE_PREFIX}${providerId}`,
        health,
        HEALTH_CACHE_TTL
      );

      return health;
    }
  }

  async getMetrics(providerId: string): Promise<ProviderMetrics | null> {
    const cached = await cacheService.get<ProviderMetrics>(
      `${METRICS_CACHE_PREFIX}${providerId}`
    );

    if (cached) {
      return cached;
    }

    // Calculate metrics from recent transactions
    const since = new Date();
    since.setHours(since.getHours() - 24); // Last 24 hours

    const transactions = await prisma.transaction.findMany({
      where: {
        providerId,
        createdAt: { gte: since },
      },
      select: {
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (transactions.length === 0) {
      return null;
    }

    const totalTransactions = transactions.length;
    const failedTransactions = transactions.filter(
      (t) => t.status === 'FAILED'
    ).length;
    const successRate = (totalTransactions - failedTransactions) / totalTransactions;

    // Calculate average latency from status history (time from PENDING to next status)
    const latencies = transactions.map((t) => {
      return t.updatedAt.getTime() - t.createdAt.getTime();
    });
    const averageLatency =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    const metrics: ProviderMetrics = {
      successRate,
      averageLatency,
      totalTransactions,
      failedTransactions,
      lastUpdated: new Date(),
    };

    await cacheService.setWithTTL(
      `${METRICS_CACHE_PREFIX}${providerId}`,
      metrics,
      METRICS_CACHE_TTL
    );

    return metrics;
  }

  async updateMetrics(
    providerId: string,
    success: boolean,
    latencyMs: number
  ): Promise<void> {
    const key = `${METRICS_CACHE_PREFIX}${providerId}:rolling`;

    // Use Redis to track rolling metrics
    const client = (await import('../../shared/database/redis.js')).getRedisClient();

    const multi = client.multi();
    const timestamp = Date.now();
    const windowMs = 3600000; // 1 hour window

    // Add to sorted set with timestamp as score
    multi.zadd(
      `${key}:transactions`,
      timestamp,
      JSON.stringify({ success, latency: latencyMs, timestamp })
    );

    // Remove old entries
    multi.zremrangebyscore(`${key}:transactions`, 0, timestamp - windowMs);

    await multi.exec();

    logger.debug('Updated provider metrics', { providerId, success, latencyMs });
  }

  private async updateProviderStatus(
    providerId: string,
    health: ProviderHealth
  ): Promise<void> {
    const statusMap: Record<ProviderHealth['status'], ProviderStatus> = {
      healthy: 'ACTIVE',
      degraded: 'DEGRADED',
      unhealthy: 'MAINTENANCE',
    };

    const newStatus = statusMap[health.status];

    await prisma.paymentProvider.update({
      where: { id: providerId },
      data: { status: newStatus },
    });
  }

  private async toProviderInfo(provider: PaymentProvider): Promise<ProviderInfo> {
    const [health, metrics] = await Promise.all([
      this.checkHealth(provider.id).catch(() => undefined),
      this.getMetrics(provider.id).catch(() => undefined),
    ]);

    return {
      id: provider.id,
      name: provider.name,
      code: provider.code,
      status: provider.status,
      supportedCurrencies: provider.supportedCurrencies,
      supportedMethods: provider.supportedMethods,
      health,
      metrics: metrics ?? undefined,
    };
  }
}

export const providerService = ProviderService.getInstance();
