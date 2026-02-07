import { Router, Request, Response, NextFunction } from 'express';
import { stripeWebhookHandler, paypalWebhookHandler } from './webhooks/index.js';
import { logger } from '../../shared/utils/logger.js';
import express from 'express';

const router = Router();

// Use raw body for webhook signature verification
const rawBodyMiddleware = express.raw({ type: 'application/json' });

/**
 * POST /api/v1/webhooks/stripe
 * Handle Stripe webhook events
 */
router.post(
  '/stripe',
  rawBodyMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const rawPayload = req.body.toString();
      const headers = req.headers as Record<string, string>;

      const result = await stripeWebhookHandler.handleWebhook(
        rawPayload,
        signature,
        headers
      );

      res.json({
        success: true,
        received: true,
        eventId: result.eventId,
      });
    } catch (error) {
      logger.error('Stripe webhook error', { error: (error as Error).message });
      // Return 200 to prevent retries for non-recoverable errors
      if ((error as Error).message === 'Invalid webhook signature') {
        res.status(400).json({ success: false, error: 'Invalid signature' });
      } else {
        next(error);
      }
    }
  }
);

/**
 * POST /api/v1/webhooks/paypal
 * Handle PayPal webhook events
 */
router.post(
  '/paypal',
  rawBodyMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['paypal-transmission-sig'] as string;
      const rawPayload = req.body.toString();
      const headers = req.headers as Record<string, string>;

      const result = await paypalWebhookHandler.handleWebhook(
        rawPayload,
        signature,
        headers
      );

      res.json({
        success: true,
        received: true,
        eventId: result.eventId,
      });
    } catch (error) {
      logger.error('PayPal webhook error', { error: (error as Error).message });
      if ((error as Error).message === 'Invalid webhook signature') {
        res.status(400).json({ success: false, error: 'Invalid signature' });
      } else {
        next(error);
      }
    }
  }
);

export { router as webhookRoutes };
