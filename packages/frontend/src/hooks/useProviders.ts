import { useQuery } from '@tanstack/react-query';
import { providersApi } from '../api';

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const response = await providersApi.list();
      return response.data.data;
    },
  });
}

export function useProviderHealth(id: string) {
  return useQuery({
    queryKey: ['provider-health', id],
    queryFn: async () => {
      const response = await providersApi.getHealth(id);
      return response.data.data;
    },
    enabled: !!id,
    refetchInterval: 30000,
  });
}
