import { Router } from 'express';
import { reconciliationController } from './reconciliation.controller.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import {
  mockSettlementQuerySchema,
  reconcileBodySchema,
  listReportsQuerySchema,
  reportIdParamSchema,
  resolveDiscrepancyBodySchema,
} from './reconciliation.schemas.js';

const router = Router();

router.get(
  '/mock-settlement',
  validateRequest({ query: mockSettlementQuerySchema }),
  reconciliationController.generateMockSettlement.bind(reconciliationController)
);

router.post(
  '/reconcile',
  validateRequest({ body: reconcileBodySchema }),
  reconciliationController.reconcile.bind(reconciliationController)
);

router.get(
  '/reports',
  validateRequest({ query: listReportsQuerySchema }),
  reconciliationController.listReports.bind(reconciliationController)
);

router.get(
  '/reports/:reportId',
  validateRequest({ params: reportIdParamSchema }),
  reconciliationController.getReport.bind(reconciliationController)
);

router.post(
  '/reports/:reportId/resolve',
  validateRequest({
    params: reportIdParamSchema,
    body: resolveDiscrepancyBodySchema,
  }),
  reconciliationController.resolveDiscrepancy.bind(reconciliationController)
);

export { router as reconciliationRoutes };
