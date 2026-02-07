import { useQuery } from '@tanstack/react-query';
import { paymentsApi, type PaymentListParams } from '../api';

export function usePayments(params?: PaymentListParams) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: async () => {
      const response = await paymentsApi.list(params);
      return response.data;
    },
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: ['payment', id],
    queryFn: async () => {
      const response = await paymentsApi.getById(id);
      return response.data.data;
    },
    enabled: !!id,
  });
}
