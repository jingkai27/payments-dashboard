import { Router } from 'express';
import { paymentMethodController } from './payment-method.controller.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import {
  createPaymentMethodBodySchema,
  updatePaymentMethodBodySchema,
  paymentMethodIdParamSchema,
  listPaymentMethodsQuerySchema,
} from './payment-method.schemas.js';

const router = Router();

/**
 * POST /api/v1/payment-methods
 * Create a new payment method
 */
router.post(
  '/',
  validateRequest({ body: createPaymentMethodBodySchema }),
  paymentMethodController.create.bind(paymentMethodController)
);

/**
 * GET /api/v1/payment-methods
 * List payment methods with filters
 */
router.get(
  '/',
  validateRequest({ query: listPaymentMethodsQuerySchema }),
  paymentMethodController.list.bind(paymentMethodController)
);

/**
 * GET /api/v1/payment-methods/:id
 * Get a payment method by ID
 */
router.get(
  '/:id',
  validateRequest({ params: paymentMethodIdParamSchema }),
  paymentMethodController.getById.bind(paymentMethodController)
);

/**
 * PATCH /api/v1/payment-methods/:id
 * Update a payment method
 */
router.patch(
  '/:id',
  validateRequest({ params: paymentMethodIdParamSchema, body: updatePaymentMethodBodySchema }),
  paymentMethodController.update.bind(paymentMethodController)
);

/**
 * DELETE /api/v1/payment-methods/:id
 * Deactivate a payment method
 */
router.delete(
  '/:id',
  validateRequest({ params: paymentMethodIdParamSchema }),
  paymentMethodController.deactivate.bind(paymentMethodController)
);

export { router as paymentMethodRoutes };
