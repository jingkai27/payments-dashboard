import { Request, Response, NextFunction } from 'express';
import { paymentMethodService } from './payment-method.service.js';
import {
  CreatePaymentMethodBody,
  UpdatePaymentMethodBody,
  PaymentMethodIdParam,
  ListPaymentMethodsQuery,
} from './payment-method.schemas.js';
import { AppError } from '../../shared/errors/app-error.js';
import { PaymentMethodType } from '@prisma/client';

export class PaymentMethodController {
  async create(
    req: Request<unknown, unknown, CreatePaymentMethodBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const pm = await paymentMethodService.create({
        customerId: req.body.customerId,
        type: req.body.type as PaymentMethodType,
        token: req.body.token,
        cardNumber: req.body.cardNumber,
        expiryMonth: req.body.expiryMonth,
        expiryYear: req.body.expiryYear,
        cvv: req.body.cvv,
        holderName: req.body.holderName,
        brand: req.body.brand,
        bankName: req.body.bankName,
        walletProvider: req.body.walletProvider,
        isDefault: req.body.isDefault,
        metadata: req.body.metadata,
      });

      res.status(201).json({
        success: true,
        data: this.formatResponse(pm),
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(
    req: Request<PaymentMethodIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const pm = await paymentMethodService.getById(req.params.id);

      if (!pm) {
        throw AppError.notFound(`Payment method ${req.params.id} not found`);
      }

      res.json({
        success: true,
        data: this.formatResponse(pm),
      });
    } catch (error) {
      next(error);
    }
  }

  async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ListPaymentMethodsQuery;

      const result = await paymentMethodService.list({
        customerId: query.customerId,
        type: query.type as PaymentMethodType | undefined,
        isActive: query.isActive,
        page: query.page,
        limit: query.limit,
      });

      res.json({
        success: true,
        data: result.paymentMethods.map((pm) => this.formatResponse(pm)),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request<PaymentMethodIdParam, unknown, UpdatePaymentMethodBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const pm = await paymentMethodService.update(req.params.id, {
        expiryMonth: req.body.expiryMonth,
        expiryYear: req.body.expiryYear,
        holderName: req.body.holderName,
        isDefault: req.body.isDefault,
        metadata: req.body.metadata,
      });

      res.json({
        success: true,
        data: this.formatResponse(pm),
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivate(
    req: Request<PaymentMethodIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const pm = await paymentMethodService.deactivate(req.params.id);

      res.json({
        success: true,
        data: this.formatResponse(pm),
      });
    } catch (error) {
      next(error);
    }
  }

  private formatResponse(pm: {
    id: string;
    customerId: string;
    type: PaymentMethodType;
    last4: string | null;
    expiryMonth: number | null;
    expiryYear: number | null;
    brand: string | null;
    bankName: string | null;
    walletProvider: string | null;
    isDefault: boolean;
    isActive: boolean;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: pm.id,
      customerId: pm.customerId,
      type: pm.type,
      last4: pm.last4,
      expiryMonth: pm.expiryMonth,
      expiryYear: pm.expiryYear,
      brand: pm.brand,
      bankName: pm.bankName,
      walletProvider: pm.walletProvider,
      isDefault: pm.isDefault,
      isActive: pm.isActive,
      metadata: pm.metadata,
      createdAt: pm.createdAt.toISOString(),
      updatedAt: pm.updatedAt.toISOString(),
    };
  }
}

export const paymentMethodController = new PaymentMethodController();
