import { useHealth, useReadiness, usePayments, useProviders } from '../hooks';
import { Card, StatusBadge } from '../components/ui';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { TransactionStatus } from '../types';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#10b981',
  PENDING: '#f59e0b',
  PROCESSING: '#3b82f6',
  FAILED: '#ef4444',
  REFUNDED: '#8b5cf6',
  CANCELLED: '#6b7280',
};

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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export default function Dashboard() {
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: readiness, isLoading: readinessLoading } = useReadiness();
  const { data: paymentsData, isLoading: paymentsLoading } = usePayments({ limit: 10 });
  const { data: providers, isLoading: _providersLoading } = useProviders();

  const transactions = paymentsData?.data ?? [];
  const totalTransactions = paymentsData?.pagination?.total ?? 0;

  // Compute stats from transactions
  const completedCount = transactions.filter((t) => t.status === 'COMPLETED').length;
  const successRate = transactions.length > 0
    ? Math.round((completedCount / transactions.length) * 100)
    : 0;
  const totalVolume = transactions
    .filter((t) => t.status === 'COMPLETED')
    .reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : Number(t.amount)), 0);
  const activeProviders = providers?.filter((p) => p.isActive).length ?? 0;

  // Active currencies from transactions
  const activeCurrencies = new Set(transactions.map((t) => t.currency));

  // Build status breakdown for pie chart
  const statusCounts = new Map<string, number>();
  for (const t of transactions) {
    statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
  }
  const statusBreakdown = Array.from(statusCounts, ([status, count]) => ({ status, count }));

  // Build volume by day for line chart (from recent transactions)
  const volumeByDay = new Map<string, { volume: number; count: number }>();
  for (const t of transactions) {
    const day = t.createdAt.split('T')[0] ?? '';
    const existing = volumeByDay.get(day) ?? { volume: 0, count: 0 };
    existing.volume += typeof t.amount === 'number' ? t.amount : Number(t.amount);
    existing.count += 1;
    volumeByDay.set(day, existing);
  }
  const volumeData = Array.from(volumeByDay, ([date, data]) => ({
    date: date.slice(5), // MM-DD format
    volume: data.volume / 100,
    count: data.count,
  })).reverse();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your payment orchestration system
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Total Transactions">
          {paymentsLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{totalTransactions}</p>
              <p className="text-sm text-gray-500">All time</p>
            </>
          )}
        </Card>

        <Card title="Success Rate">
          <p className={`text-3xl font-bold ${successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
            {transactions.length > 0 ? `${successRate}%` : '--'}
          </p>
          <p className="text-sm text-gray-500">
            {completedCount} of {transactions.length} recent
          </p>
        </Card>

        <Card title="Active Currencies">
          {paymentsLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{activeCurrencies.size}</p>
              <p className="text-sm text-gray-500">
                {activeCurrencies.size > 0
                  ? Array.from(activeCurrencies).join(', ')
                  : 'No currencies yet'}
              </p>
            </>
          )}
        </Card>

        <Card title="Volume (Recent)">
          <p className="text-3xl font-bold text-gray-900">
            {transactions.length > 0 ? formatCurrency(totalVolume) : '$0'}
          </p>
          <p className="text-sm text-gray-500">
            {activeProviders} active provider{activeProviders !== 1 ? 's' : ''}
          </p>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Revenue Chart" subtitle="Transaction volume over time">
          {paymentsLoading ? (
            <p className="text-gray-400 py-8 text-center">Loading...</p>
          ) : volumeData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Volume']}
                  />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    stroke="#0284c7"
                    strokeWidth={2}
                    dot={{ fill: '#0284c7', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No transaction data yet</p>
              <p className="text-sm">Charts will populate as transactions are processed</p>
            </div>
          )}
        </Card>

        <Card title="Status Breakdown" subtitle="Transaction status distribution">
          {paymentsLoading ? (
            <p className="text-gray-400 py-8 text-center">Loading...</p>
          ) : statusBreakdown.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusBreakdown.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] ?? '#6b7280'}
                      />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No transaction data yet</p>
              <p className="text-sm">Status distribution will appear here</p>
            </div>
          )}
        </Card>
      </div>

      {/* System Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="System Health" subtitle="Current system status">
          {healthLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : health ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status</span>
                <StatusBadge
                  status={health.status === 'healthy' ? 'success' : 'error'}
                  label={health.status}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Version</span>
                <span className="font-mono text-sm">{health.version}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Uptime</span>
                <span className="font-mono text-sm">
                  {Math.floor(health.uptime / 60)}m {Math.floor(health.uptime % 60)}s
                </span>
              </div>
            </div>
          ) : (
            <p className="text-red-500">Failed to load health status</p>
          )}
        </Card>

        <Card title="Service Status" subtitle="Database and cache connectivity">
          {readinessLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : readiness ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Database</span>
                <div className="flex items-center space-x-2">
                  <StatusBadge
                    status={readiness.checks.database.status === 'up' ? 'success' : 'error'}
                    label={readiness.checks.database.status}
                  />
                  {readiness.checks.database.latency && (
                    <span className="text-xs text-gray-500">
                      {readiness.checks.database.latency}ms
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Redis</span>
                <div className="flex items-center space-x-2">
                  <StatusBadge
                    status={readiness.checks.redis.status === 'up' ? 'success' : 'error'}
                    label={readiness.checks.redis.status}
                  />
                  {readiness.checks.redis.latency && (
                    <span className="text-xs text-gray-500">
                      {readiness.checks.redis.latency}ms
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-red-500">Failed to load service status</p>
          )}
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card title="Recent Transactions" subtitle="Latest payment activity">
        {paymentsLoading ? (
          <p className="text-gray-400 text-center py-8">Loading...</p>
        ) : transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.slice(0, 5).map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {t.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{t.type}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(typeof t.amount === 'number' ? t.amount : Number(t.amount), t.currency)} {t.currency}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={getStatusBadgeType(t.status)}
                        label={t.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No recent activity</p>
            <p className="text-sm">Transaction history will appear here as payments are processed</p>
          </div>
        )}
      </Card>
    </div>
  );
}
