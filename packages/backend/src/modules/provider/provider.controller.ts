import { Request, Response, NextFunction } from 'express';
import { providerService } from './provider.service.js';
import { ListProvidersQuery } from './provider.schemas.js';
import { AppError } from '../../shared/errors/app-error.js';
import { Currency, PaymentMethodType, ProviderStatus } from '@prisma/client';

export class ProviderController {
  async listProviders(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ListProvidersQuery;
      const { status, currency, method, page, limit } = query;

      const result = await providerService.listProviders({
        status: status as ProviderStatus | undefined,
        currency: currency as Currency | undefined,
        method: method as PaymentMethodType | undefined,
        page,
        limit,
      });

      res.json({
        success: true,
        data: result.providers,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProvider(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const provider = await providerService.getProvider(id);

      if (!provider) {
        throw AppError.notFound(`Provider with ID ${id} not found`);
      }

      res.json({
        success: true,
        data: provider,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProviderHealth(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const provider = await providerService.getProvider(id);

      if (!provider) {
        throw AppError.notFound(`Provider with ID ${id} not found`);
      }

      const health = await providerService.checkHealth(id);
      const metrics = await providerService.getMetrics(id);

      res.json({
        success: true,
        data: {
          providerId: id,
          providerCode: provider.code,
          ...health,
          lastCheck: health.lastCheck.toISOString(),
          metrics: metrics
            ? {
                ...metrics,
                lastUpdated: metrics.lastUpdated.toISOString(),
              }
            : undefined,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const providerController = new ProviderController();
