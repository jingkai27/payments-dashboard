import { useState } from 'react';
import { useProviders, useFxRates } from '../hooks';
import { Card, StatusBadge } from '../components/ui';
import type { Currency } from '../types';

const BASE_CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'SGD', 'JPY'];

function getProviderStatusType(status: string) {
  const map: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
    ACTIVE: 'success',
    DEGRADED: 'warning',
    MAINTENANCE: 'info',
    INACTIVE: 'error',
  };
  return map[status] ?? 'info';
}

export default function Settings() {
  const { data: providers, isLoading: providersLoading, isError: providersError } = useProviders();
  const [baseCurrency, setBaseCurrency] = useState<Currency>('USD');
  const { data: fxData, isLoading: fxLoading, isError: fxError } = useFxRates(baseCurrency);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage provider configuration and view exchange rates
        </p>
      </div>

      {/* Provider Configuration */}
      <Card title="Provider Configuration" subtitle="View and manage payment providers">
        {providersLoading ? (
          <div className="text-center py-8 text-gray-500">Loading providers...</div>
        ) : providersError ? (
          <div className="text-center py-8 text-red-500">Failed to load providers</div>
        ) : providers && providers.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {providers.map((provider) => (
              <div key={provider.id} className="py-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-medium text-gray-900">{provider.name}</h4>
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {provider.code}
                    </span>
                    <StatusBadge
                      status={getProviderStatusType(provider.status)}
                      label={provider.status}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500">Currencies:</span>
                    {provider.supportedCurrencies.map((c) => (
                      <span
                        key={c}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500">Methods:</span>
                    {provider.supportedMethods.map((m) => (
                      <span
                        key={m}
                        className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ml-4">
                  <button
                    type="button"
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-default rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      provider.isActive ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={provider.isActive}
                    aria-label={`${provider.name} is ${provider.isActive ? 'active' : 'inactive'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        provider.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No providers configured</p>
            <p className="text-sm mt-1">Providers will appear here once configured in the system</p>
          </div>
        )}
      </Card>

      {/* Currency Rate View */}
      <Card title="Currency Rates" subtitle="Current FX exchange rates">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Base Currency</label>
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value as Currency)}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2 border"
          >
            {BASE_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {fxLoading ? (
          <div className="text-center py-8 text-gray-500">Loading exchange rates...</div>
        ) : fxError ? (
          <div className="text-center py-8 text-red-500">
            <p>Failed to load exchange rates</p>
            <p className="text-sm mt-1">Ensure the backend FX service is running</p>
          </div>
        ) : fxData?.rates ? (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency Pair</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Inverse</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(fxData.rates)
                    .filter(([currency]) => currency !== baseCurrency)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([currency, rate]) => (
                      <tr key={currency} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {baseCurrency} / {currency}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-gray-900">
                          {Number(rate).toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-gray-500">
                          {(1 / Number(rate)).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {fxData.timestamp && (
              <p className="mt-3 text-xs text-gray-400 text-right">
                Last updated: {new Date(fxData.timestamp).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No rate data available</p>
            <p className="text-sm mt-1">Rates will appear once the FX service provides data</p>
          </div>
        )}
      </Card>
    </div>
  );
}
