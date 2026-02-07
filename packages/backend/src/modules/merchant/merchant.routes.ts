import { Router } from 'express';
import { merchantController } from './merchant.controller.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import {
  createMerchantBodySchema,
  updateMerchantBodySchema,
  merchantIdParamSchema,
  listMerchantsQuerySchema,
  createCustomerBodySchema,
  updateCustomerBodySchema,
  customerIdParamSchema,
  listCustomersQuerySchema,
} from './merchant.schemas.js';

const router = Router();

// ── Merchant Routes ──

/**
 * POST /api/v1/merchants
 * Create a new merchant
 */
router.post(
  '/',
  validateRequest({ body: createMerchantBodySchema }),
  merchantController.createMerchant.bind(merchantController)
);

/**
 * GET /api/v1/merchants
 * List merchants
 */
router.get(
  '/',
  validateRequest({ query: listMerchantsQuerySchema }),
  merchantController.listMerchants.bind(merchantController)
);

/**
 * GET /api/v1/merchants/:id
 * Get a merchant by ID
 */
router.get(
  '/:id',
  validateRequest({ params: merchantIdParamSchema }),
  merchantController.getMerchant.bind(merchantController)
);

/**
 * PATCH /api/v1/merchants/:id
 * Update a merchant
 */
router.patch(
  '/:id',
  validateRequest({ params: merchantIdParamSchema, body: updateMerchantBodySchema }),
  merchantController.updateMerchant.bind(merchantController)
);

// ── Customer Routes ──

/**
 * POST /api/v1/merchants/customers
 * Create a new customer
 */
router.post(
  '/customers',
  validateRequest({ body: createCustomerBodySchema }),
  merchantController.createCustomer.bind(merchantController)
);

/**
 * GET /api/v1/merchants/customers
 * List customers
 */
router.get(
  '/customers',
  validateRequest({ query: listCustomersQuerySchema }),
  merchantController.listCustomers.bind(merchantController)
);

/**
 * GET /api/v1/merchants/customers/:id
 * Get a customer by ID
 */
router.get(
  '/customers/:id',
  validateRequest({ params: customerIdParamSchema }),
  merchantController.getCustomer.bind(merchantController)
);

/**
 * PATCH /api/v1/merchants/customers/:id
 * Update a customer
 */
router.patch(
  '/customers/:id',
  validateRequest({ params: customerIdParamSchema, body: updateCustomerBodySchema }),
  merchantController.updateCustomer.bind(merchantController)
);

export { router as merchantRoutes };
