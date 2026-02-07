import { Request, Response, NextFunction } from 'express';
import { routingService } from './routing.service.js';
import {
  RoutingPreviewBody,
  ListRulesQuery,
  CreateRuleBody,
  UpdateRuleBody,
  RuleIdParam,
} from './routing.schemas.js';
import { RoutingContext } from './routing.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { Currency, PaymentMethodType } from '@prisma/client';

export class RoutingController {
  async previewRouting(
    req: Request<unknown, unknown, RoutingPreviewBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const context: RoutingContext = {
        merchantId: req.body.merchantId,
        amount: req.body.amount,
        currency: req.body.currency as Currency,
        paymentMethodType: req.body.paymentMethodType as PaymentMethodType,
        cardBrand: req.body.cardBrand,
        country: req.body.country,
        region: req.body.region,
        customerId: req.body.customerId,
        metadata: req.body.metadata,
      };

      const decision = await routingService.selectProvider(context);

      res.json({
        success: true,
        data: {
          selectedProviderId: decision.selectedProviderId,
          selectedProviderCode: decision.selectedProviderCode,
          fallbackProviderIds: decision.fallbackProviderIds,
          matchedRuleId: decision.matchedRuleId,
          score: decision.score,
          reason: decision.reason,
          evaluatedAt: decision.evaluatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async listRules(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ListRulesQuery;
      const { merchantId, isActive, page, limit } = query;

      const result = await routingService.listRules(merchantId, {
        isActive,
        page,
        limit,
      });

      res.json({
        success: true,
        data: result.rules.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
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

  async createRule(
    req: Request<unknown, unknown, CreateRuleBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const rule = await routingService.createRule(req.body);

      res.status(201).json({
        success: true,
        data: {
          ...rule,
          createdAt: rule.createdAt.toISOString(),
          updatedAt: rule.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getRule(
    req: Request<RuleIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const rule = await routingService.getRule(id);

      if (!rule) {
        throw AppError.notFound(`Routing rule with ID ${id} not found`);
      }

      res.json({
        success: true,
        data: {
          ...rule,
          createdAt: rule.createdAt.toISOString(),
          updatedAt: rule.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRule(
    req: Request<RuleIdParam, unknown, UpdateRuleBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const rule = await routingService.updateRule(id, req.body);

      if (!rule) {
        throw AppError.notFound(`Routing rule with ID ${id} not found`);
      }

      res.json({
        success: true,
        data: {
          ...rule,
          createdAt: rule.createdAt.toISOString(),
          updatedAt: rule.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRule(
    req: Request<RuleIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const deleted = await routingService.deleteRule(id);

      if (!deleted) {
        throw AppError.notFound(`Routing rule with ID ${id} not found`);
      }

      res.json({
        success: true,
        data: { deleted: true },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const routingController = new RoutingController();
