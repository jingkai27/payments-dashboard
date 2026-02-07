import { apiClient } from './client';
import type { ApiResponse, ReconciliationSummary, ReconciliationReport, SettlementRecord } from '../types';

export interface MockSettlementParams {
  merchantId: string;
  providerId: string;
  fromDate: string;
  toDate: string;
  format?: 'json' | 'csv';
  introduceDiscrepancies?: boolean;
}

export interface ReconcileRequest {
  merchantId: string;
  providerId: string;
  fromDate: string;
  toDate: string;
  settlementData: SettlementRecord[];
}

export interface ListReportsParams {
  merchantId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ResolveDiscrepancyRequest {
  discrepancyId: string;
  resolution: 'force_match' | 'refund' | 'ignore';
  resolvedBy?: string;
}

interface ReportsListResponse {
  success: boolean;
  data: ReconciliationSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const reconciliationApi = {
  generateMockSettlement: (params: MockSettlementParams) =>
    apiClient.get<ApiResponse<SettlementRecord[]>>('/reconciliation/mock-settlement', { params }),

  reconcile: (data: ReconcileRequest) =>
    apiClient.post<ApiResponse<ReconciliationReport>>('/reconciliation/reconcile', data),

  listReports: (params?: ListReportsParams) =>
    apiClient.get<ReportsListResponse>('/reconciliation/reports', { params }),

  getReport: (reportId: string) =>
    apiClient.get<ApiResponse<ReconciliationReport>>(`/reconciliation/reports/${reportId}`),

  resolveDiscrepancy: (reportId: string, data: ResolveDiscrepancyRequest) =>
    apiClient.post<ApiResponse<ReconciliationReport>>(`/reconciliation/reports/${reportId}/resolve`, data),
};
