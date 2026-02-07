export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code?: string, details?: unknown): AppError {
    return new AppError(message, 400, code ?? 'BAD_REQUEST', true, details);
  }

  static unauthorized(message: string = 'Unauthorized', code?: string): AppError {
    return new AppError(message, 401, code ?? 'UNAUTHORIZED', true);
  }

  static forbidden(message: string = 'Forbidden', code?: string): AppError {
    return new AppError(message, 403, code ?? 'FORBIDDEN', true);
  }

  static notFound(message: string = 'Resource not found', code?: string): AppError {
    return new AppError(message, 404, code ?? 'NOT_FOUND', true);
  }

  static conflict(message: string, code?: string, details?: unknown): AppError {
    return new AppError(message, 409, code ?? 'CONFLICT', true, details);
  }

  static unprocessableEntity(message: string, code?: string, details?: unknown): AppError {
    return new AppError(message, 422, code ?? 'UNPROCESSABLE_ENTITY', true, details);
  }

  static tooManyRequests(message: string = 'Too many requests', code?: string): AppError {
    return new AppError(message, 429, code ?? 'TOO_MANY_REQUESTS', true);
  }

  static internal(message: string = 'Internal server error', code?: string): AppError {
    return new AppError(message, 500, code ?? 'INTERNAL_ERROR', false);
  }

  static serviceUnavailable(message: string = 'Service unavailable', code?: string): AppError {
    return new AppError(message, 503, code ?? 'SERVICE_UNAVAILABLE', true);
  }
}
