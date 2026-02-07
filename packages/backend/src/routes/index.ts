import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { paymentRoutes } from '../modules/payment/index.js';
import { providerRoutes, webhookRoutes } from '../modules/provider/index.js';
import { fxRoutes } from '../modules/fx/index.js';
import { routingRoutes } from '../modules/routing/index.js';
import { ledgerRoutes } from '../modules/ledger/index.js';
import { paymentMethodRoutes } from '../modules/payment-method/index.js';
import { merchantRoutes } from '../modules/merchant/index.js';
import { authRoutes } from '../modules/auth/index.js';
import { analyticsRoutes } from '../modules/analytics/index.js';
import { fraudRoutes } from '../modules/fraud/index.js';
import { reconciliationRoutes } from '../modules/reconciliation/index.js';

const router = Router();

// Auth routes (public)
router.use('/auth', authRoutes);

// Mount routes
router.use('/health', healthRoutes);

// Core payment routes
router.use('/payments', paymentRoutes);
router.use('/providers', providerRoutes);
router.use('/fx', fxRoutes);
router.use('/routing', routingRoutes);
router.use('/webhooks', webhookRoutes);

// Ledger routes
router.use('/ledger', ledgerRoutes);

// Payment method routes
router.use('/payment-methods', paymentMethodRoutes);

// Merchant & customer routes
router.use('/merchants', merchantRoutes);

// Analytics, fraud & reconciliation routes
router.use('/analytics', analyticsRoutes);
router.use('/fraud', fraudRoutes);
router.use('/reconciliation', reconciliationRoutes);

export default router;
