import { useQuery } from '@tanstack/react-query';
import { healthApi } from '../api';

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await healthApi.getHealth();
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useReadiness() {
  return useQuery({
    queryKey: ['readiness'],
    queryFn: async () => {
      const response = await healthApi.getReadiness();
      return response.data;
    },
    refetchInterval: 30000,
  });
}
