import { Router } from 'express';
import { fraudController } from './fraud.controller.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import {
  fraudCheckBodySchema,
  flaggedTransactionsQuerySchema,
  fraudReviewBodySchema,
  transactionIdParamSchema,
} from './fraud.schemas.js';

const router = Router();

router.post(
  '/check',
  validateRequest({ body: fraudCheckBodySchema }),
  fraudController.checkTransaction.bind(fraudController)
);

router.get(
  '/flagged',
  validateRequest({ query: flaggedTransactionsQuerySchema }),
  fraudController.getFlaggedTransactions.bind(fraudController)
);

router.post(
  '/:transactionId/review',
  validateRequest({
    params: transactionIdParamSchema,
    body: fraudReviewBodySchema,
  }),
  fraudController.reviewTransaction.bind(fraudController)
);

export { router as fraudRoutes };
