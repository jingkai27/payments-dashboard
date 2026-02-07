import { apiClient } from './client';
import type { PaymentProvider, ApiResponse } from '../types';

export interface ProviderListResponse {
  success: boolean;
  data: PaymentProvider[];
}

export interface ProviderHealthResponse {
  success: boolean;
  data: {
    providerId: string;
    name: string;
    status: string;
    successRate: number;
    avgLatency: number;
    totalTransactions: number;
    lastChecked: string;
  };
}

export const providersApi = {
  list: () =>
    apiClient.get<ProviderListResponse>('/providers'),

  getById: (id: string) =>
    apiClient.get<ApiResponse<PaymentProvider>>(`/providers/${id}`),

  getHealth: (id: string) =>
    apiClient.get<ProviderHealthResponse>(`/providers/${id}/health`),
};
