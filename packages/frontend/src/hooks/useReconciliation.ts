import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  reconciliationApi,
  type ListReportsParams,
  type MockSettlementParams,
  type ReconcileRequest,
  type ResolveDiscrepancyRequest,
} from '../api/reconciliation';

export function useReconciliationReports(params?: ListReportsParams) {
  return useQuery({
    queryKey: ['reconciliation', 'reports', params],
    queryFn: async () => {
      const response = await reconciliationApi.listReports(params);
      return response.data;
    },
  });
}

export function useReconciliationReport(reportId: string) {
  return useQuery({
    queryKey: ['reconciliation', 'report', reportId],
    queryFn: async () => {
      const response = await reconciliationApi.getReport(reportId);
      return response.data.data;
    },
    enabled: !!reportId,
  });
}

export function useGenerateMockSettlement() {
  return useMutation({
    mutationFn: async (params: MockSettlementParams) => {
      const response = await reconciliationApi.generateMockSettlement(params);
      return response.data.data;
    },
  });
}

export function useReconcile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ReconcileRequest) => {
      const response = await reconciliationApi.reconcile(data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation', 'reports'] });
    },
  });
}

export function useResolveDiscrepancy(reportId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ResolveDiscrepancyRequest) => {
      const response = await reconciliationApi.resolveDiscrepancy(reportId, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation', 'report', reportId] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation', 'reports'] });
    },
  });
}
