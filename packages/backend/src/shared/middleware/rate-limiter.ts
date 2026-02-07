import rateLimit from 'express-rate-limit';
import { config } from '../../config/index.js';
import { AppError } from '../errors/app-error.js';

export const rateLimiter = rateLimit({
  windowMs: config.env.RATE_LIMIT_WINDOW_MS,
  max: config.env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    return (
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.ip ||
      'unknown'
    );
  },
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests('Rate limit exceeded. Please try again later.'));
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path.startsWith('/api/v1/health');
  },
});
