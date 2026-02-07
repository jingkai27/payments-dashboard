import { apiClient } from './client';
import type { ApiResponse, RealTimeStats, HistoricalDataPoint, ProviderHealthData } from '../types';

export interface HistoricalStatsParams {
  granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  currency?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface ProviderHealthParams {
  granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export const analyticsApi = {
  getRealTimeStats: () =>
    apiClient.get<ApiResponse<RealTimeStats>>('/analytics/real-time'),

  getHistoricalStats: (params?: HistoricalStatsParams) =>
    apiClient.get<ApiResponse<HistoricalDataPoint[]>>('/analytics/historical', { params }),

  getProviderHealth: (params?: ProviderHealthParams) =>
    apiClient.get<ApiResponse<ProviderHealthData[]>>('/analytics/provider-health', { params }),
};
