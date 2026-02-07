import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service.js';
import type { HistoricalQueryInput, ProviderHealthQueryInput } from './analytics.schemas.js';
import type { Currency } from '@prisma/client';

export class AnalyticsController {
  async getRealTimeStats(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await analyticsService.getRealTimeStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getHistoricalStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as HistoricalQueryInput;
      const data = await analyticsService.getHistoricalStats({
        granularity: query.granularity,
        currency: query.currency as Currency | undefined,
        fromDate: query.fromDate,
        toDate: query.toDate,
        limit: query.limit,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getProviderHealth(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ProviderHealthQueryInput;
      const data = await analyticsService.getProviderHealth(
        query.granularity,
        query.fromDate,
        query.toDate,
        query.limit
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
