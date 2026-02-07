import { Request, Response, NextFunction } from 'express';
import { paymentService } from './payment.service.js';
import {
  CreatePaymentBody,
  PaymentIdParam,
  ListPaymentsQuery,
  CapturePaymentBody,
  RefundPaymentBody,
  CancelPaymentBody,
} from './payment.schemas.js';
import { CreatePaymentRequest } from './payment.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { Currency, PaymentMethodType, TransactionStatus, TransactionType } from '@prisma/client';

export class PaymentController {
  async createPayment(
    req: Request<unknown, unknown, CreatePaymentBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const paymentRequest: CreatePaymentRequest = {
        merchantId: req.body.merchantId,
        customerId: req.body.customerId,
        amount: req.body.amount,
        currency: req.body.currency as Currency,
        targetCurrency: req.body.targetCurrency as Currency | undefined,
        paymentMethod: {
          type: req.body.paymentMethod.type as PaymentMethodType,
          token: req.body.paymentMethod.token,
          cardNumber: req.body.paymentMethod.cardNumber,
          expiryMonth: req.body.paymentMethod.expiryMonth,
          expiryYear: req.body.paymentMethod.expiryYear,
          cvv: req.body.paymentMethod.cvv,
          holderName: req.body.paymentMethod.holderName,
        },
        capture: req.body.capture,
        description: req.body.description,
        metadata: req.body.metadata,
        idempotencyKey: req.body.idempotencyKey,
      };

      const payment = await paymentService.createPayment(paymentRequest);

      res.status(201).json({
        success: true,
        data: this.formatPaymentResponse(payment),
      });
    } catch (error) {
      next(error);
    }
  }

  async getPayment(
    req: Request<PaymentIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const payment = await paymentService.getPayment(id);

      if (!payment) {
        throw AppError.notFound(`Payment with ID ${id} not found`);
      }

      res.json({
        success: true,
        data: this.formatPaymentResponse(payment),
      });
    } catch (error) {
      next(error);
    }
  }

  async listPayments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ListPaymentsQuery;
      const result = await paymentService.listPayments({
        merchantId: query.merchantId,
        customerId: query.customerId,
        status: query.status as TransactionStatus | undefined,
        type: query.type as TransactionType | undefined,
        currency: query.currency as Currency | undefined,
        fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
        toDate: query.toDate ? new Date(query.toDate) : undefined,
        page: query.page,
        limit: query.limit,
      });

      res.json({
        success: true,
        data: result.payments.map((p) => this.formatPaymentResponse(p)),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async capturePayment(
    req: Request<PaymentIdParam, unknown, CapturePaymentBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const payment = await paymentService.capturePayment(id, {
        amount: req.body.amount,
      });

      res.json({
        success: true,
        data: this.formatPaymentResponse(payment),
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelPayment(
    req: Request<PaymentIdParam, unknown, CancelPaymentBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const payment = await paymentService.cancelPayment(id, req.body?.reason);

      res.json({
        success: true,
        data: this.formatPaymentResponse(payment),
      });
    } catch (error) {
      next(error);
    }
  }

  async refundPayment(
    req: Request<PaymentIdParam, unknown, RefundPaymentBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      const payment = await paymentService.refundPayment(id, {
        amount: req.body.amount,
        reason: req.body.reason,
      });

      res.json({
        success: true,
        data: this.formatPaymentResponse(payment),
      });
    } catch (error) {
      next(error);
    }
  }

  private formatPaymentResponse(payment: {
    id: string;
    merchantId: string;
    customerId?: string;
    providerId?: string;
    providerTransactionId?: string;
    type: TransactionType;
    status: TransactionStatus;
    amount: bigint;
    currency: Currency;
    convertedAmount?: bigint;
    convertedCurrency?: Currency;
    description?: string;
    failureReason?: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: payment.id,
      merchantId: payment.merchantId,
      customerId: payment.customerId,
      providerId: payment.providerId,
      providerTransactionId: payment.providerTransactionId,
      type: payment.type,
      status: payment.status,
      amount: payment.amount.toString(),
      currency: payment.currency,
      convertedAmount: payment.convertedAmount?.toString(),
      convertedCurrency: payment.convertedCurrency,
      description: payment.description,
      failureReason: payment.failureReason,
      metadata: payment.metadata,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }
}

export const paymentController = new PaymentController();
