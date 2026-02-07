# Phase 3: Frontend Dashboard Implementation Plan

## Goal Description
Build the **Frontend Dashboard** to visualize real-time transaction data, monitor payment provider performance, and manage system configuration.

## Proposed Changes

### Frontend Structure (`packages/frontend`)
#### [NEW] Components & Pages
- **Layout**: `MainLayout` with Sidebar navigation (Dashboard, Transactions, Settings).
- **Dashboard**:
  - `StatsCards`: Total Volume, Success Rate, Active Currencies.
  - `RevenueChart`: Line chart for transaction volume over time (Recharts).
  - `RecentTransactions`: Simplified table view.
- **Transactions**:
  - `TransactionTable`: Detailed list with status badges (Success, Pending, Failed), filtering/sorting.
  - `TransactionDetails`: Modal or side-panel for specific transaction info.
- TODO: **Checkout Simulator / Playground**:
  - A test page with a simple payment form (Card Number, Amount, Currency).
  - Simulates a merchant checkout connecting to our API.
- **Settings**:
  - `ProviderConfig`: Toggle providers on/off.
  - `CurrencyRateView`: Display current FX rates.

#### [MODIFY] API Integration
- Create `api/client.ts` using Axios or Fetch.
- Implement data fetching hooks (e.g., `useTransactions`, `useDashboardStats`) using React Query.
- **Mock Data**: Setup a mock server (MirageJS or just static JSON files) if backend endpoints are not fully ready, ensuring frontend development can proceed in parallel.

## Verification Plan

### Automated Tests
- **Unit Tests**:
  - Test utility functions (e.g., currency formatting).
  - Test component rendering with mock data (Vitest + React Testing Library).

### Manual Verification
1. **Start System**: `npm run dev` in `packages/frontend`.
2. **Dashboard Logic**:
   - Verify `StatsCards` update correctly when new mock transactions are added.
   - Check `RevenueChart` rendering.
3. **Transaction Flow**:
   - Navigate to **Transactions** page.
   - Click a transaction to view details.
4. **Checkout Simulation**:
   - Go to **Simulator** page.
   - Enter amount and currency.
   - Click "Pay" and watch it appear in **Dashboards**.
5. **Responsive Check**:
   - Resize window to ensure layout adapts (Tailwind classes).
