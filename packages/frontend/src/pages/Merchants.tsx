import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api';
import { Card, StatusBadge, Button } from '../components/ui';
import type { Merchant } from '../types';

interface MerchantListResponse {
  success: boolean;
  data: Merchant[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function MerchantsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['merchants', page],
    queryFn: async () => {
      const response = await apiClient.get<MerchantListResponse>('/merchants', {
        params: { page, limit: 20 },
      });
      return response.data;
    },
  });

  const merchants = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Merchants</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage merchant accounts and configurations
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading merchants...</div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">Failed to load merchants</div>
      ) : merchants.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No merchants found</p>
            <p className="text-sm mt-1">Merchants will appear here once onboarded</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {merchants.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.name}</p>
                        <p className="text-xs text-gray-500">{m.legalName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{m.email}</td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        {m.defaultCurrency}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        status={m.isActive ? 'success' : 'error'}
                        label={m.isActive ? 'Active' : 'Inactive'}
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
