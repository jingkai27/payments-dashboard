import { Request, Response, NextFunction } from 'express';
import { merchantService } from './merchant.service.js';
import {
  CreateMerchantBody,
  UpdateMerchantBody,
  MerchantIdParam,
  ListMerchantsQuery,
  CreateCustomerBody,
  UpdateCustomerBody,
  CustomerIdParam,
  ListCustomersQuery,
} from './merchant.schemas.js';
import { AppError } from '../../shared/errors/app-error.js';
import { Currency } from '@prisma/client';

export class MerchantController {
  // ── Merchant Endpoints ──

  async createMerchant(
    req: Request<unknown, unknown, CreateMerchantBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const merchant = await merchantService.createMerchant({
        name: req.body.name,
        legalName: req.body.legalName,
        email: req.body.email,
        defaultCurrency: req.body.defaultCurrency as Currency,
        settings: req.body.settings,
        metadata: req.body.metadata,
      });

      res.status(201).json({
        success: true,
        data: this.formatMerchant(merchant),
      });
    } catch (error) {
      next(error);
    }
  }

  async getMerchant(
    req: Request<MerchantIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const merchant = await merchantService.getMerchant(req.params.id);
      if (!merchant) {
        throw AppError.notFound(`Merchant ${req.params.id} not found`);
      }

      res.json({
        success: true,
        data: this.formatMerchant(merchant),
      });
    } catch (error) {
      next(error);
    }
  }

  async listMerchants(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ListMerchantsQuery;
      const result = await merchantService.listMerchants({
        isActive: query.isActive,
        page: query.page,
        limit: query.limit,
      });

      res.json({
        success: true,
        data: result.items.map((m) => this.formatMerchant(m)),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMerchant(
    req: Request<MerchantIdParam, unknown, UpdateMerchantBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const merchant = await merchantService.updateMerchant(req.params.id, {
        name: req.body.name,
        legalName: req.body.legalName,
        email: req.body.email,
        defaultCurrency: req.body.defaultCurrency as Currency | undefined,
        settings: req.body.settings,
        metadata: req.body.metadata,
        isActive: req.body.isActive,
      });

      res.json({
        success: true,
        data: this.formatMerchant(merchant),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── Customer Endpoints ──

  async createCustomer(
    req: Request<unknown, unknown, CreateCustomerBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customer = await merchantService.createCustomer({
        merchantId: req.body.merchantId,
        externalId: req.body.externalId,
        email: req.body.email,
        name: req.body.name,
        metadata: req.body.metadata,
      });

      res.status(201).json({
        success: true,
        data: this.formatCustomer(customer),
      });
    } catch (error) {
      next(error);
    }
  }

  async getCustomer(
    req: Request<CustomerIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customer = await merchantService.getCustomer(req.params.id);
      if (!customer) {
        throw AppError.notFound(`Customer ${req.params.id} not found`);
      }

      res.json({
        success: true,
        data: this.formatCustomer(customer),
      });
    } catch (error) {
      next(error);
    }
  }

  async listCustomers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ListCustomersQuery;
      const result = await merchantService.listCustomers({
        merchantId: query.merchantId,
        email: query.email,
        isActive: query.isActive,
        page: query.page,
        limit: query.limit,
      });

      res.json({
        success: true,
        data: result.items.map((c) => this.formatCustomer(c)),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCustomer(
    req: Request<CustomerIdParam, unknown, UpdateCustomerBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customer = await merchantService.updateCustomer(req.params.id, {
        email: req.body.email,
        name: req.body.name,
        metadata: req.body.metadata,
        isActive: req.body.isActive,
      });

      res.json({
        success: true,
        data: this.formatCustomer(customer),
      });
    } catch (error) {
      next(error);
    }
  }

  // ── Formatters ──

  private formatMerchant(m: {
    id: string;
    name: string;
    legalName: string;
    email: string;
    defaultCurrency: Currency;
    settings: Record<string, unknown>;
    metadata: Record<string, unknown>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: m.id,
      name: m.name,
      legalName: m.legalName,
      email: m.email,
      defaultCurrency: m.defaultCurrency,
      settings: m.settings,
      metadata: m.metadata,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  private formatCustomer(c: {
    id: string;
    merchantId: string;
    externalId: string | null;
    email: string | null;
    name: string | null;
    metadata: Record<string, unknown>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: c.id,
      merchantId: c.merchantId,
      externalId: c.externalId,
      email: c.email,
      name: c.name,
      metadata: c.metadata,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}

export const merchantController = new MerchantController();
