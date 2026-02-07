import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { logger } from '../utils/logger.js';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
  requestId?: string;
}

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string | undefined;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      requestId,
    };

    logger.warn('Validation error', {
      requestId,
      path: req.path,
      errors: err.errors,
    });

    res.status(400).json(response);
    return;
  }

  // Handle AppError (operational errors)
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      requestId,
    };

    if (err.isOperational) {
      logger.warn('Operational error', {
        requestId,
        path: req.path,
        code: err.code,
        message: err.message,
      });
    } else {
      logger.error('Non-operational error', {
        requestId,
        path: req.path,
        code: err.code,
        message: err.message,
        stack: err.stack,
      });
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  logger.error('Unhandled error', {
    requestId,
    path: req.path,
    message: err.message,
    stack: err.stack,
  });

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env['NODE_ENV'] === 'production'
          ? 'An unexpected error occurred'
          : err.message,
      stack:
        process.env['NODE_ENV'] === 'development' ? err.stack : undefined,
    },
    requestId,
  };

  res.status(500).json(response);
};
