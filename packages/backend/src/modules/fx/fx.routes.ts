import { Router } from 'express';
import { fxController } from './fx.controller.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import {
  getRateQuerySchema,
  getAllRatesQuerySchema,
  convertBodySchema,
  quoteBodySchema,
  refreshRatesBodySchema,
} from './fx.schemas.js';

const router = Router();

/**
 * GET /api/v1/fx/rates
 * Get exchange rate for a currency pair
 */
router.get(
  '/rates',
  validateRequest({ query: getRateQuerySchema }),
  fxController.getRate.bind(fxController)
);

/**
 * GET /api/v1/fx/rates/all
 * Get all exchange rates for a base currency
 */
router.get(
  '/rates/all',
  validateRequest({ query: getAllRatesQuerySchema }),
  fxController.getAllRates.bind(fxController)
);

/**
 * POST /api/v1/fx/convert
 * Convert an amount between currencies
 */
router.post(
  '/convert',
  validateRequest({ body: convertBodySchema }),
  fxController.convert.bind(fxController)
);

/**
 * POST /api/v1/fx/quote
 * Get a time-limited conversion quote
 */
router.post(
  '/quote',
  validateRequest({ body: quoteBodySchema }),
  fxController.getQuote.bind(fxController)
);

/**
 * POST /api/v1/fx/rates/refresh
 * Force refresh rates from external provider
 */
router.post(
  '/rates/refresh',
  validateRequest({ body: refreshRatesBodySchema }),
  fxController.refreshRates.bind(fxController)
);

export { router as fxRoutes };
