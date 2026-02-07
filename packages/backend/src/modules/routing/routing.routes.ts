import { Router } from 'express';
import { routingController } from './routing.controller.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import {
  routingPreviewBodySchema,
  listRulesQuerySchema,
  createRuleBodySchema,
  updateRuleBodySchema,
  ruleIdParamSchema,
} from './routing.schemas.js';

const router = Router();

/**
 * POST /api/v1/routing/preview
 * Preview routing decision for a payment context
 */
router.post(
  '/preview',
  validateRequest({ body: routingPreviewBodySchema }),
  routingController.previewRouting.bind(routingController)
);

/**
 * GET /api/v1/routing/rules
 * List routing rules for a merchant
 */
router.get(
  '/rules',
  validateRequest({ query: listRulesQuerySchema }),
  routingController.listRules.bind(routingController)
);

/**
 * POST /api/v1/routing/rules
 * Create a new routing rule
 */
router.post(
  '/rules',
  validateRequest({ body: createRuleBodySchema }),
  routingController.createRule.bind(routingController)
);

/**
 * GET /api/v1/routing/rules/:id
 * Get a routing rule by ID
 */
router.get(
  '/rules/:id',
  validateRequest({ params: ruleIdParamSchema }),
  routingController.getRule.bind(routingController)
);

/**
 * PUT /api/v1/routing/rules/:id
 * Update a routing rule
 */
router.put(
  '/rules/:id',
  validateRequest({ params: ruleIdParamSchema, body: updateRuleBodySchema }),
  routingController.updateRule.bind(routingController)
);

/**
 * DELETE /api/v1/routing/rules/:id
 * Delete a routing rule
 */
router.delete(
  '/rules/:id',
  validateRequest({ params: ruleIdParamSchema }),
  routingController.deleteRule.bind(routingController)
);

export { router as routingRoutes };
