import { NavLink } from 'react-router-dom';

interface HeaderProps {
  title?: string;
}

export default function Header({ title = 'Payment Orchestration' }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </div>
          <nav className="flex items-center space-x-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium ${isActive ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'}`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/payments"
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium ${isActive ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'}`
              }
            >
              Payments
            </NavLink>
            <NavLink
              to="/providers"
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium ${isActive ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'}`
              }
            >
              Providers
            </NavLink>
            <NavLink
              to="/merchants"
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium ${isActive ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'}`
              }
            >
              Merchants
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}
