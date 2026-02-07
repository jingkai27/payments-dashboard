import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from './auth.middleware.js';
import { validateRequest } from '../../shared/middleware/validate-request.js';
import {
  registerBodySchema,
  loginBodySchema,
} from './auth.schemas.js';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
router.post(
  '/register',
  validateRequest({ body: registerBodySchema }),
  authController.register.bind(authController)
);

/**
 * POST /api/v1/auth/login
 * Login with credentials
 */
router.post(
  '/login',
  validateRequest({ body: loginBodySchema }),
  authController.login.bind(authController)
);

/**
 * GET /api/v1/auth/profile
 * Get current user profile (requires auth)
 */
router.get(
  '/profile',
  authenticate,
  authController.getProfile.bind(authController)
);

export { router as authRoutes };
