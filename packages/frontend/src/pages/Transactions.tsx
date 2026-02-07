import { useState } from 'react';
import { usePayments } from '../hooks';
import { Card, StatusBadge, Button } from '../components/ui';
import type { TransactionStatus, Currency } from '../types';

const STATUS_OPTIONS: TransactionStatus[] = [
  'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED',
];

const CURRENCY_OPTIONS: Currency[] = [
  'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
];

function getStatusBadgeType(status: TransactionStatus) {
  const map: Record<TransactionStatus, 'success' | 'warning' | 'error' | 'info' | 'pending'> = {
    COMPLETED: 'success',
    PENDING: 'pending',
    PROCESSING: 'info',
    FAILED: 'error',
    REFUNDED: 'warning',
    CANCELLED: 'pending',
  };
  return map[status] ?? 'pending';
}

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

export default function Transactions() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError } = usePayments({
    page,
    limit: 20,
    status: statusFilter || undefined,
    currency: currencyFilter || undefined,
  });

  const transactions = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
        <p className="mt-1 text-sm text-gray-500">
          View and manage all payment transactions
        </p>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2 border"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={currencyFilter}
              onChange={(e) => { setCurrencyFilter(e.target.value); setPage(1); }}
              className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2 border"
            >
              <option value="">All Currencies</option>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setStatusFilter(''); setCurrencyFilter(''); setPage(1); }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Transaction Table */}
      <Card>
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading transactions...</div>
        ) : isError ? (
          <div className="text-center py-12 text-red-500">Failed to load transactions</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No transactions found</p>
            <p className="text-sm mt-1">Transactions will appear here once payments are processed</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedId === t.id ? 'bg-primary-50' : ''}`}
                      onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
                    >
                      <td className="px-4 py-4 text-sm font-mono text-gray-900">
                        {t.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          t.type === 'PAYMENT' ? 'bg-blue-100 text-blue-800' :
                          t.type === 'REFUND' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {formatCurrency(typeof t.amount === 'number' ? t.amount : Number(t.amount), t.currency)}
                        <span className="text-gray-500 ml-1">{t.currency}</span>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge
                          status={getStatusBadgeType(t.status)}
                          label={t.status}
                        />
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {t.providerId ? t.providerId.slice(0, 8) + '...' : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Transaction Detail Panel */}
            {selectedId && (() => {
              const t = transactions.find((tx) => tx.id === selectedId);
              if (!t) return null;
              return (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3">Transaction Details</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Full ID</span>
                      <p className="font-mono text-gray-900 break-all">{t.id}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Merchant ID</span>
                      <p className="font-mono text-gray-900">{t.merchantId.slice(0, 12)}...</p>
                    </div>
                    {t.customerId && (
                      <div>
                        <span className="text-gray-500">Customer ID</span>
                        <p className="font-mono text-gray-900">{t.customerId.slice(0, 12)}...</p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Amount</span>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(typeof t.amount === 'number' ? t.amount : Number(t.amount), t.currency)} {t.currency}
                      </p>
                    </div>
                    {t.convertedAmount && t.convertedCurrency && (
                      <div>
                        <span className="text-gray-500">Converted</span>
                        <p className="font-medium text-gray-900">
                          {formatCurrency(typeof t.convertedAmount === 'number' ? t.convertedAmount : Number(t.convertedAmount), t.convertedCurrency)} {t.convertedCurrency}
                        </p>
                      </div>
                    )}
                    {t.description && (
                      <div>
                        <span className="text-gray-500">Description</span>
                        <p className="text-gray-900">{t.description}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Created</span>
                      <p className="text-gray-900">{new Date(t.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Updated</span>
                      <p className="text-gray-900">{new Date(t.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} results
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
                  <span className="px-3 py-1.5 text-sm text-gray-700">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
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
          </>
        )}
      </Card>
    </div>
  );
}
