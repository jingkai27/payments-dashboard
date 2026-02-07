import { useProviders } from '../hooks';
import { Card, StatusBadge } from '../components/ui';
import type { ProviderStatus } from '../types';

function getProviderStatusType(status: ProviderStatus) {
  const map: Record<ProviderStatus, 'success' | 'warning' | 'error' | 'info' | 'pending'> = {
    ACTIVE: 'success',
    DEGRADED: 'warning',
    MAINTENANCE: 'info',
    INACTIVE: 'error',
  };
  return map[status] ?? 'pending';
}

export default function Providers() {
  const { data: providers, isLoading, isError } = useProviders();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payment Providers</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage and monitor your payment provider integrations
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading providers...</div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">Failed to load providers</div>
      ) : !providers || providers.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No providers configured</p>
            <p className="text-sm mt-1">Add payment providers to start processing transactions</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
                    <p className="text-sm text-gray-500 font-mono">{provider.code}</p>
                  </div>
                  <StatusBadge
                    status={getProviderStatusType(provider.status)}
                    label={provider.status}
                  />
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Supported Currencies</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {provider.supportedCurrencies.map((c) => (
                        <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Payment Methods</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {provider.supportedMethods.map((m) => (
                        <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                          {m.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-sm text-gray-500">
                    {provider.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${provider.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
