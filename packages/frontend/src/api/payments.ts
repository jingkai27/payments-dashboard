import { apiClient } from './client';
import type { Transaction, ApiResponse } from '../types';

export interface PaymentListParams {
  merchantId?: string;
  customerId?: string;
  status?: string;
  type?: string;
  currency?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface PaymentListResponse {
  success: boolean;
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardStats {
  totalTransactions: number;
  successRate: number;
  totalVolume: number;
  activeProviders: number;
  recentTransactions: Transaction[];
  volumeByDay: { date: string; volume: number; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  providerBreakdown: { provider: string; count: number; successRate: number }[];
}

export const paymentsApi = {
  list: (params?: PaymentListParams) =>
    apiClient.get<PaymentListResponse>('/payments', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Transaction>>(`/payments/${id}`),

  capture: (id: string, amount?: number) =>
    apiClient.post<ApiResponse<Transaction>>(`/payments/${id}/capture`, { amount }),

  cancel: (id: string, reason?: string) =>
    apiClient.post<ApiResponse<Transaction>>(`/payments/${id}/cancel`, { reason }),

  refund: (id: string, amount?: number, reason?: string) =>
    apiClient.post<ApiResponse<Transaction>>(`/payments/${id}/refund`, { amount, reason }),
};
