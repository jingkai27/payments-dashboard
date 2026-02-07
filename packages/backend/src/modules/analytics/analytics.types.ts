import { Currency } from '@prisma/client';

export interface RealTimeStats {
  totalTransactions: number;
  successRate: number;
  volumeByCurrency: Record<string, number>;
  transactionsPerMinute: number;
  activeProviders: number;
}

export interface HistoricalDataPoint {
  period: string;
  successCount: number;
  failureCount: number;
  totalCount: number;
  totalVolume: string;
  avgAmount: string;
}

export type TimeGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface HistoricalQuery {
  granularity: TimeGranularity;
  currency?: Currency;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface ProviderHealthData {
  providerId: string;
  providerName: string;
  providerCode: string;
  totalTransactions: number;
  successCount: number;
  failureCount: number;
  errorRate: number;
  avgLatencyMs: number;
  dataPoints: ProviderHealthDataPoint[];
}

export interface ProviderHealthDataPoint {
  period: string;
  successCount: number;
  failureCount: number;
  errorRate: number;
}
