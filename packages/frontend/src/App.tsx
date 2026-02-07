import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Providers from './pages/Providers';
import Merchants from './pages/Merchants';
import Settings from './pages/Settings';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import ReconciliationCenter from './pages/ReconciliationCenter';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="payments" element={<Transactions />} />
        <Route path="providers" element={<Providers />} />
        <Route path="merchants" element={<Merchants />} />
        <Route path="settings" element={<Settings />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="reconciliation" element={<ReconciliationCenter />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
