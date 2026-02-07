# Multi-Currency Payment Orchestration System
![Dashboard Overview](./assets/dashboard.png)
## Project Overview
To facilitate some of the learnings that I have in my finance course, I did some research and built a **simplified payment orchestration platform** that routes transactions across multiple payment providers, handles currency conversion, and provides real-time transaction monitoring.

## Core Features

**1. Payment Gateway Orchestration**
- Integrate with 2-3 payment provider APIs (Stripe, PayPal Sandbox, or similar test environments)
- Implement intelligent routing logic that selects the optimal provider based on:
  - Transaction amount and currency
  - Geographic location
  - Provider success rates and fees
  - Provider availability (fallback mechanism)

**2. Multi-Currency Support**
- Real-time FX rate fetching from a public API (e.g., exchangerate-api.io)
- Currency conversion calculator with spread margins
- Support for at least 5 major currencies (USD, EUR, GBP, SGD, JPY)
- Historical FX rate tracking and visualization

**3. Transaction Monitoring Dashboard**
- Real-time transaction status tracking
- Success/failure rate analytics by provider and currency
- Transaction timeline visualization
- Fraud detection simulation (flag suspicious patterns like rapid repeated transactions)

**4. Payment Method Management**
- Support multiple payment methods (cards, wallets, bank transfers)
- Tokenization simulation for storing payment credentials securely
- Payment method preference settings per user/region

**5. Reconciliation Module**
- Generate transaction reports
- Settlement status tracking
- Discrepancy detection between expected and actual amounts

## Key Learnings & Technical Skills

### 1. Financial Domain Knowledge
- **Payment Routing**: Understanding how to dynamically route transactions to minimize fees and maximize success rates.
- **Ledger & Reconciliation**: Implementing double-entry accounting principles to ensure financial accuracy and identifying discrepancies between internal records and provider statements.
- **Foreign Exchange (FX)**: Handling multi-currency transactions, understanding spread, and real-time rate management.
- **Compliance & Security**: Concepts of tokenization (PCI-DSS compliance) and fraud detection patterns.

### 2. Backend Engineering
- **Modular Monolith Architecture**: Designing a system that is easy to develop locally but ready to be split into microservices (Payment, Ledger, FX services) as it scales.
- **Concurrency & Locking**: Handling race conditions in financial transactions to prevent double-spending or invalid balance updates.
- **Database Design**: Using PostgreSQL for ACID-compliant transactional integrity and Redis for high-performance caching of session data and FX rates.

### 3. Frontend & UX
- **Real-Time Dashboards**: Visualizing complex financial data using React and Recharts with low latency.
- **Optimistic UI**: Improving perceived performance while ensuring data consistency in the background.

## Technical Stack

**Backend**
- **Language**: TypeScript (Node.js)
- **Framework**: Express.js
- **Database**: PostgreSQL (Transactional), Redis (Caching)
- **Architecture**: Modular Monolith / Microservices ready

**Frontend**
- **Framework**: React (Vite)
- **Styling**: TailwindCSS
- **Visualization**: Recharts/Chart.js

## Project Roadmap

### Phase 1: Foundation
- Project scaffolding
- Database schema design
- Basic API setup

### Phase 2: Core Payment Logic
- Mock Provider integrations
- Routing engine implementation
- FX Service integration

### Phase 3: Frontend Dashboard
- Dashboard UI implementation
- Real-time data integration

### Phase 4: Advanced Features
- Monitoring and Analytics
- Reconciliation module
