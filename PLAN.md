# Implementation Plan - Multi-Currency Payment Orchestration System

## Goal Description
Build a simplified payment orchestration platform that routes transactions across multiple payment providers, handles currency conversion, and provides real-time transaction monitoring.

## Proposed Architecture

### Project Structure (Monorepo)
```
/
  packages/
    backend/  (Express + TS)
    frontend/ (React + Vite)
  docker-compose.yml
  README.md
```

### Backend (`packages/backend`)
- **Framework**: Express with TypeScript.
- **Database ORM**: Prisma.
- **Key Modules**:
    - `PaymentService`: Handles routing logic (Smart Routing).
    - `ProviderService`: Interface for Stripe/PayPal mock integrations.
    - `FxService`: Fetches rates from external API and calculates conversions.
    - `LedgerService`: Records transactions and handles reconciliation.

### Frontend (`packages/frontend`)
- **Framework**: React with Vite.
- **Styling**: TailwindCSS.
- **Features**:
    - Dashboard with charts.
    - Transaction timeline.
    - Payment Method configuration forms.

### Infrastructure
- **Docker Compose**: Orchestrate Postgres, Redis, and the Backend/Frontend services for local development.

## Verification Plan

### Automated Tests
- **Backend**: Jest for unit/integration tests.
    - Test `routeTransaction` logic.
    - Test `convertCurrency` calculation.

### Manual Verification
1. **Start System**: `docker-compose up`
2. **Simulate Transaction**:
    - POST `/api/v1/payments` via Swagger/Postman.
    - Verify data in DB and Dashboard.
3. **Test Failover**:
    - Simulate provider downtime and verify fallback routing.
