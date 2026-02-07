import { Router } from 'express';
import { analyticsController } from './analytics.controller.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import { historicalQuerySchema, providerHealthQuerySchema } from './analytics.schemas.js';

const router = Router();

router.get(
  '/real-time',
  analyticsController.getRealTimeStats.bind(analyticsController)
);

router.get(
  '/historical',
  validateRequest({ query: historicalQuerySchema }),
  analyticsController.getHistoricalStats.bind(analyticsController)
);

router.get(
  '/provider-health',
  validateRequest({ query: providerHealthQuerySchema }),
  analyticsController.getProviderHealth.bind(analyticsController)
);

export { router as analyticsRoutes };
