import { Router } from 'express';
import { ledgerController } from './ledger.controller.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import {
  createLedgerEntriesBodySchema,
  listLedgerEntriesQuerySchema,
  accountCodeParamSchema,
  transactionIdParamSchema,
  balanceQuerySchema,
} from './ledger.schemas.js';

const router = Router();

/**
 * POST /api/v1/ledger/entries
 * Create double-entry ledger entries for a transaction
 */
router.post(
  '/entries',
  validateRequest({ body: createLedgerEntriesBodySchema }),
  ledgerController.createEntries.bind(ledgerController)
);

/**
 * GET /api/v1/ledger/entries
 * List ledger entries with filters
 */
router.get(
  '/entries',
  validateRequest({ query: listLedgerEntriesQuerySchema }),
  ledgerController.listEntries.bind(ledgerController)
);

/**
 * GET /api/v1/ledger/transactions/:transactionId
 * Get all ledger entries for a specific transaction
 */
router.get(
  '/transactions/:transactionId',
  validateRequest({ params: transactionIdParamSchema }),
  ledgerController.getEntriesByTransaction.bind(ledgerController)
);

/**
 * GET /api/v1/ledger/accounts/:accountCode/balance
 * Get balance for a specific account
 */
router.get(
  '/accounts/:accountCode/balance',
  validateRequest({ params: accountCodeParamSchema, query: balanceQuerySchema }),
  ledgerController.getAccountBalance.bind(ledgerController)
);

/**
 * GET /api/v1/ledger/summary
 * Get full ledger summary across all accounts
 */
router.get(
  '/summary',
  ledgerController.getSummary.bind(ledgerController)
);

export { router as ledgerRoutes };
