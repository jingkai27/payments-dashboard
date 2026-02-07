import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
};
