import { useState } from 'react';
import { useRealTimeStats, useHistoricalStats, useProviderHealth } from '../hooks/useAnalytics';
import { Card, StatusBadge } from '../components/ui';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function formatPeriodLabel(period: string, granularity: Granularity): string {
  const date = new Date(period);
  if (granularity === 'hourly') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (granularity === 'daily') return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  if (granularity === 'weekly') return `Wk ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
}

export default function AnalyticsDashboard() {
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const { data: realTime, isLoading: rtLoading } = useRealTimeStats();
  const { data: historical, isLoading: histLoading } = useHistoricalStats({ granularity, limit: 30 });
  const { data: providerHealth, isLoading: phLoading } = useProviderHealth({ granularity: 'daily', limit: 14 });

  const histChartData = (historical ?? []).map((d) => ({
    period: formatPeriodLabel(d.period, granularity),
    success: d.successCount,
    failure: d.failureCount,
    total: d.totalCount,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">Real-time and historical payment analytics</p>
      </div>

      {/* Real-time stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card title="Total Transactions">
          {rtLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{realTime?.totalTransactions ?? 0}</p>
              <p className="text-sm text-gray-500">All time</p>
            </>
          )}
        </Card>

        <Card title="Success Rate">
          {rtLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <>
              <p className={`text-3xl font-bold ${(realTime?.successRate ?? 0) >= 90 ? 'text-green-600' : (realTime?.successRate ?? 0) >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                {realTime?.successRate ?? 0}%
              </p>
              <p className="text-sm text-gray-500">Across all transactions</p>
            </>
          )}
        </Card>

        <Card title="Volume (Completed)">
          {rtLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(Object.values(realTime?.volumeByCurrency ?? {}).reduce((a, b) => a + b, 0))}
              </p>
              <p className="text-sm text-gray-500">
                {Object.keys(realTime?.volumeByCurrency ?? {}).length} currencies
              </p>
            </>
          )}
        </Card>

        <Card title="Active Providers">
          {rtLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{realTime?.activeProviders ?? 0}</p>
              <p className="text-sm text-gray-500">{realTime?.transactionsPerMinute ?? 0} txns/min</p>
            </>
          )}
        </Card>
      </div>

      {/* Historical chart with period selector */}
      <Card title="Historical Trends" subtitle="Transaction success/failure over time">
        <div className="flex gap-2 mb-4">
          {(['hourly', 'daily', 'weekly', 'monthly'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 text-sm rounded-md ${
                granularity === g
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>

        {histLoading ? (
          <p className="text-gray-400 py-8 text-center">Loading...</p>
        ) : histChartData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={histChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="success" stroke="#10b981" strokeWidth={2} name="Success" />
                <Line type="monotone" dataKey="failure" stroke="#ef4444" strokeWidth={2} name="Failure" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No historical data available</p>
          </div>
        )}
      </Card>

      {/* Provider health */}
      <Card title="Provider Health" subtitle="Per-provider error rate and latency">
        {phLoading ? (
          <p className="text-gray-400 py-8 text-center">Loading...</p>
        ) : (providerHealth ?? []).length > 0 ? (
          <div className="space-y-6">
            {(providerHealth ?? []).map((provider) => (
              <div key={provider.providerId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{provider.providerName}</h4>
                    <p className="text-sm text-gray-500">{provider.providerCode}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Txns: </span>
                      <span className="font-medium">{provider.totalTransactions}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Latency: </span>
                      <span className="font-medium">{provider.avgLatencyMs}ms</span>
                    </div>
                    <StatusBadge
                      status={provider.errorRate < 5 ? 'success' : provider.errorRate < 15 ? 'warning' : 'error'}
                      label={`${provider.errorRate}% error`}
                    />
                  </div>
                </div>
                {provider.dataPoints.length > 0 && (
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={provider.dataPoints.map((dp) => ({
                        ...dp,
                        period: formatPeriodLabel(dp.period, 'daily'),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip />
                        <Line type="monotone" dataKey="errorRate" stroke="#ef4444" strokeWidth={1.5} name="Error %" />
                        <Line type="monotone" dataKey="successCount" stroke="#10b981" strokeWidth={1.5} name="Success" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No provider health data available</p>
          </div>
        )}
      </Card>
    </div>
  );
}
