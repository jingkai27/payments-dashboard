import { prisma } from '../../shared/database/prisma.js';
import { cacheService } from '../../shared/cache/cache.service.js';
import { logger } from '../../shared/utils/logger.js';
import type {
  RealTimeStats,
  HistoricalDataPoint,
  HistoricalQuery,
  ProviderHealthData,
  TimeGranularity,
} from './analytics.types.js';

export class AnalyticsService {
  private static instance: AnalyticsService | null = null;

  private constructor() {}

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async getRealTimeStats(): Promise<RealTimeStats> {
    const cached = await cacheService.getOrSet<RealTimeStats>(
      'analytics:realtime',
      () => this.computeRealTimeStats(),
      30
    );
    return cached!;
  }

  async getHistoricalStats(query: HistoricalQuery): Promise<HistoricalDataPoint[]> {
    const cacheKey = `analytics:historical:${query.granularity}:${query.currency ?? 'all'}:${query.limit}`;
    const cached = await cacheService.getOrSet<HistoricalDataPoint[]>(
      cacheKey,
      () => this.computeHistoricalStats(query),
      300
    );
    return cached!;
  }

  async getProviderHealth(
    granularity: TimeGranularity = 'daily',
    fromDate?: string,
    toDate?: string,
    limit = 14
  ): Promise<ProviderHealthData[]> {
    const cacheKey = `analytics:provider-health:${granularity}:${limit}`;
    const cached = await cacheService.getOrSet<ProviderHealthData[]>(
      cacheKey,
      () => this.computeProviderHealth(granularity, fromDate, toDate, limit),
      300
    );
    return cached!;
  }

  private async computeRealTimeStats(): Promise<RealTimeStats> {
    logger.info('Computing real-time analytics stats');

    const oneMinuteAgo = new Date(Date.now() - 60_000);

    const [totalResult, statusCounts, volumeByC, recentCount, providerCount] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.transaction.groupBy({
        by: ['currency'],
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: { createdAt: { gte: oneMinuteAgo } },
      }),
      prisma.paymentProvider.count({ where: { isActive: true } }),
    ]);

    const completed = statusCounts.find((s) => s.status === 'COMPLETED')?._count.id ?? 0;
    const successRate = totalResult > 0 ? (completed / totalResult) * 100 : 0;

    const volumeByCurrency: Record<string, number> = {};
    for (const v of volumeByC) {
      volumeByCurrency[v.currency] = Number(v._sum.amount ?? 0);
    }

    return {
      totalTransactions: totalResult,
      successRate: Math.round(successRate * 100) / 100,
      volumeByCurrency,
      transactionsPerMinute: recentCount,
      activeProviders: providerCount,
    };
  }

  private async computeHistoricalStats(query: HistoricalQuery): Promise<HistoricalDataPoint[]> {
    logger.info('Computing historical analytics stats', { query });

    const truncUnit = this.getDateTruncUnit(query.granularity);
    const whereConditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (query.currency) {
      whereConditions.push(`currency = $${paramIdx}::\"Currency\"`);
      params.push(query.currency);
      paramIdx++;
    }
    if (query.fromDate) {
      whereConditions.push(`created_at >= $${paramIdx}::timestamptz`);
      params.push(query.fromDate);
      paramIdx++;
    }
    if (query.toDate) {
      whereConditions.push(`created_at <= $${paramIdx}::timestamptz`);
      params.push(query.toDate);
      paramIdx++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const limitVal = query.limit ?? 30;
    params.push(limitVal);

    const sql = `
      SELECT
        DATE_TRUNC('${truncUnit}', created_at) AS period,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') AS success_count,
        COUNT(*) FILTER (WHERE status = 'FAILED') AS failure_count,
        COUNT(*) AS total_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'COMPLETED'), 0) AS total_volume,
        COALESCE(AVG(amount), 0) AS avg_amount
      FROM transactions
      ${whereClause}
      GROUP BY period
      ORDER BY period DESC
      LIMIT $${paramIdx}
    `;

    const rows = await prisma.$queryRawUnsafe<Array<{
      period: Date;
      success_count: bigint;
      failure_count: bigint;
      total_count: bigint;
      total_volume: bigint;
      avg_amount: bigint;
    }>>(sql, ...params);

    return rows.map((row) => ({
      period: row.period.toISOString(),
      successCount: Number(row.success_count),
      failureCount: Number(row.failure_count),
      totalCount: Number(row.total_count),
      totalVolume: row.total_volume.toString(),
      avgAmount: row.avg_amount.toString(),
    })).reverse();
  }

  private async computeProviderHealth(
    granularity: TimeGranularity,
    fromDate?: string,
    toDate?: string,
    limit = 14
  ): Promise<ProviderHealthData[]> {
    logger.info('Computing provider health stats');

    const providers = await prisma.paymentProvider.findMany({
      where: { isActive: true },
    });

    const results: ProviderHealthData[] = [];

    for (const provider of providers) {
      const truncUnit = this.getDateTruncUnit(granularity);
      const whereConditions = [`provider_id = $1`];
      const params: (string | number)[] = [provider.id];
      let paramIdx = 2;

      if (fromDate) {
        whereConditions.push(`created_at >= $${paramIdx}::timestamptz`);
        params.push(fromDate);
        paramIdx++;
      }
      if (toDate) {
        whereConditions.push(`created_at <= $${paramIdx}::timestamptz`);
        params.push(toDate);
        paramIdx++;
      }

      const whereClause = whereConditions.join(' AND ');
      params.push(limit);

      const sql = `
        SELECT
          DATE_TRUNC('${truncUnit}', created_at) AS period,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') AS success_count,
          COUNT(*) FILTER (WHERE status = 'FAILED') AS failure_count
        FROM transactions
        WHERE ${whereClause}
        GROUP BY period
        ORDER BY period DESC
        LIMIT $${paramIdx}
      `;

      const rows = await prisma.$queryRawUnsafe<Array<{
        period: Date;
        success_count: bigint;
        failure_count: bigint;
      }>>(sql, ...params);

      const totalTxns = rows.reduce((sum, r) => sum + Number(r.success_count) + Number(r.failure_count), 0);
      const totalSuccess = rows.reduce((sum, r) => sum + Number(r.success_count), 0);
      const totalFailure = rows.reduce((sum, r) => sum + Number(r.failure_count), 0);

      results.push({
        providerId: provider.id,
        providerName: provider.name,
        providerCode: provider.code,
        totalTransactions: totalTxns,
        successCount: totalSuccess,
        failureCount: totalFailure,
        errorRate: totalTxns > 0 ? Math.round((totalFailure / totalTxns) * 10000) / 100 : 0,
        avgLatencyMs: Math.round(Math.random() * 200 + 100), // simulated latency
        dataPoints: rows.map((row) => {
          const sc = Number(row.success_count);
          const fc = Number(row.failure_count);
          const total = sc + fc;
          return {
            period: row.period.toISOString(),
            successCount: sc,
            failureCount: fc,
            errorRate: total > 0 ? Math.round((fc / total) * 10000) / 100 : 0,
          };
        }).reverse(),
      });
    }

    return results;
  }

  private getDateTruncUnit(granularity: TimeGranularity): string {
    const map: Record<TimeGranularity, string> = {
      hourly: 'hour',
      daily: 'day',
      weekly: 'week',
      monthly: 'month',
    };
    return map[granularity];
  }
}

export const analyticsService = AnalyticsService.getInstance();
