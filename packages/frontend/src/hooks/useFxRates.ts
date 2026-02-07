import { useQuery } from '@tanstack/react-query';
import { fxApi } from '../api/fx';
import type { Currency } from '../types';

export function useFxRates(base: Currency = 'USD') {
  return useQuery({
    queryKey: ['fxRates', base],
    queryFn: async () => {
      const { data } = await fxApi.getAllRates(base);
      return data.data;
    },
    refetchInterval: 60000, // Refresh every 60 seconds
  });
}
