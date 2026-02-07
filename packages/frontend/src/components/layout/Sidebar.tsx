import { NavLink } from 'react-router-dom';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Payments', href: '/payments', icon: '💳' },
  { name: 'Providers', href: '/providers', icon: '🏦' },
  { name: 'Merchants', href: '/merchants', icon: '🏪' },
  { name: 'FX Rates', href: '/fx', icon: '💱' },
  { name: 'Ledger', href: '/ledger', icon: '📒' },
  { name: 'Analytics', href: '/analytics', icon: '📈' },
  { name: 'Reconciliation', href: '/reconciliation', icon: '🔍' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 min-h-screen">
      <div className="p-4">
        <h2 className="text-white text-lg font-semibold">Payment Orchestration</h2>
        <p className="text-gray-400 text-sm">Multi-Currency Platform</p>
      </div>
      <nav className="mt-4">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center px-4 py-3 text-sm font-medium ${
                isActive
                  ? 'bg-gray-800 text-white border-l-4 border-primary-500'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span className="mr-3">{item.icon}</span>
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
