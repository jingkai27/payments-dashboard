# Phase 4: Advanced Features Implementation Plan

## Goal Description
Implement **Advanced Monitoring, Analytics, and Reconciliation** to provide deep insights into payment flows and ensure financial integrity.

## Proposed Changes

### Backend (`packages/backend`)
#### [NEW] Services
- **`AnalyticsService`**:
  - Aggregates data for real-time dashboards (Success Rates, Volume by Currency).
  - Endpoints: `GET /stats/real-time`, `GET /stats/historical`.
- **`FraudService` (Simulation)**:
  - Middleware to analyze incoming transactions.
  - **Rules**: Flag if > $5000 or > 3 txns/minute from same IP.
  - Action: Mark status as `FLAGGED_FOR_REVIEW`.
- **`ReconciliationService`**:
  - **Mock Gen**: Create fake "Daily Settlement Files" (CSV/JSON) from providers.
  - **Logic**: Compare Provider CSV vs Local DB.
  - **Output**: Discrepancy Report (Missing in DB, Amount Mismatch).

### Frontend (`packages/frontend`)
#### [NEW] Pages & Views
- **Analytics Dashboard**:
  - Advanced boolean search/filter for transactions.
  - Charts: "Provider Health" (Latency/Errors over time).
- **Reconciliation Center**:
  - **Upload**: Dropzone for mock provider reports.
  - **Results Table**: Highlights unmatched or mismatched records.
  - **Action**: "Force Match" or "Refund" buttons.

## Verification Plan

### Automated Tests
- **Unit**: Test Fraud rules logic (e.g., does it catch the 4th txn in a minute?).
- **Integration**: Test Reconciliation logic with a deliberately mismatched CSV file.

### Manual Verification
1. **Fraud Simulation**:
   - Spam 5 small transactions rapidly.
   - Verify 4th+ are flagged in the UI.
2. **Reconciliation Flow**:
   - Run "Generate Mock Report" script.
   - Manually alter one record in the DB to create a mismatch.
   - Run Reconciliation and verify the discrepancy appears in the Dashboard.
