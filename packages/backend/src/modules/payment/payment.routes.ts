import { Router } from 'express';
import { paymentController } from './payment.controller.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import {
  createPaymentBodySchema,
  paymentIdParamSchema,
  listPaymentsQuerySchema,
  capturePaymentBodySchema,
  refundPaymentBodySchema,
  cancelPaymentBodySchema,
} from './payment.schemas.js';

const router = Router();

/**
 * POST /api/v1/payments
 * Create a new payment
 */
router.post(
  '/',
  validateRequest({ body: createPaymentBodySchema }),
  paymentController.createPayment.bind(paymentController)
);

/**
 * GET /api/v1/payments
 * List payments with filters
 */
router.get(
  '/',
  validateRequest({ query: listPaymentsQuerySchema }),
  paymentController.listPayments.bind(paymentController)
);

/**
 * GET /api/v1/payments/:id
 * Get a payment by ID
 */
router.get(
  '/:id',
  validateRequest({ params: paymentIdParamSchema }),
  paymentController.getPayment.bind(paymentController)
);

/**
 * POST /api/v1/payments/:id/capture
 * Capture a pending payment
 */
router.post(
  '/:id/capture',
  validateRequest({ params: paymentIdParamSchema, body: capturePaymentBodySchema }),
  paymentController.capturePayment.bind(paymentController)
);

/**
 * POST /api/v1/payments/:id/cancel
 * Cancel a pending payment
 */
router.post(
  '/:id/cancel',
  validateRequest({ params: paymentIdParamSchema, body: cancelPaymentBodySchema }),
  paymentController.cancelPayment.bind(paymentController)
);

/**
 * POST /api/v1/payments/:id/refund
 * Refund a completed payment
 */
router.post(
  '/:id/refund',
  validateRequest({ params: paymentIdParamSchema, body: refundPaymentBodySchema }),
  paymentController.refundPayment.bind(paymentController)
);

export { router as paymentRoutes };
