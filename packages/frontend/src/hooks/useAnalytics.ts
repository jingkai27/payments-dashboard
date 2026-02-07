import { useQuery } from '@tanstack/react-query';
import { analyticsApi, type HistoricalStatsParams, type ProviderHealthParams } from '../api/analytics';

export function useRealTimeStats() {
  return useQuery({
    queryKey: ['analytics', 'real-time'],
    queryFn: async () => {
      const response = await analyticsApi.getRealTimeStats();
      return response.data.data;
    },
    refetchInterval: 30_000,
  });
}

export function useHistoricalStats(params?: HistoricalStatsParams) {
  return useQuery({
    queryKey: ['analytics', 'historical', params],
    queryFn: async () => {
      const response = await analyticsApi.getHistoricalStats(params);
      return response.data.data;
    },
  });
}

export function useProviderHealth(params?: ProviderHealthParams) {
  return useQuery({
    queryKey: ['analytics', 'provider-health', params],
    queryFn: async () => {
      const response = await analyticsApi.getProviderHealth(params);
      return response.data.data;
    },
    refetchInterval: 60_000,
  });
}
