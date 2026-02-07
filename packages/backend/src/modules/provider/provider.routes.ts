import { Router } from 'express';
import { providerController } from './provider.controller.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import {
  providerIdParamSchema,
  listProvidersQuerySchema,
} from './provider.schemas.js';

const router = Router();

/**
 * GET /api/v1/providers
 * List all providers with optional filters
 */
router.get(
  '/',
  validateRequest({ query: listProvidersQuerySchema }),
  providerController.listProviders.bind(providerController)
);

/**
 * GET /api/v1/providers/:id
 * Get a single provider by ID
 */
router.get(
  '/:id',
  validateRequest({ params: providerIdParamSchema }),
  providerController.getProvider.bind(providerController)
);

/**
 * GET /api/v1/providers/:id/health
 * Get provider health status and metrics
 */
router.get(
  '/:id/health',
  validateRequest({ params: providerIdParamSchema }),
  providerController.getProviderHealth.bind(providerController)
);

export { router as providerRoutes };
