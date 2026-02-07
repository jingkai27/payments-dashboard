import { PaymentMethodType, Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';
import {
  CreatePaymentMethodRequest,
  UpdatePaymentMethodRequest,
  PaymentMethodResponse,
  ListPaymentMethodsFilter,
  PaymentMethodListResponse,
  PaymentMethodError,
} from './payment-method.types.js';

export class PaymentMethodService {
  private static instance: PaymentMethodService | null = null;

  private constructor() {}

  static getInstance(): PaymentMethodService {
    if (!PaymentMethodService.instance) {
      PaymentMethodService.instance = new PaymentMethodService();
    }
    return PaymentMethodService.instance;
  }

  async create(request: CreatePaymentMethodRequest): Promise<PaymentMethodResponse> {
    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: request.customerId },
    });

    if (!customer) {
      throw PaymentMethodError.customerNotFound(request.customerId);
    }

    // Extract last4 from card number if provided
    const last4 = request.cardNumber
      ? request.cardNumber.slice(-4)
      : null;

    // Tokenize card (in production this would go to a vault)
    const token = request.token ?? this.generateToken();

    // If setting as default, unset other defaults for this customer
    if (request.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { customerId: request.customerId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        customerId: request.customerId,
        type: request.type,
        token,
        last4,
        expiryMonth: request.expiryMonth ?? null,
        expiryYear: request.expiryYear ?? null,
        brand: request.brand ?? this.detectCardBrand(request.cardNumber),
        bankName: request.bankName ?? null,
        walletProvider: request.walletProvider ?? null,
        isDefault: request.isDefault ?? false,
        metadata: (request.metadata ?? {}) as object,
      },
    });

    logger.info('Payment method created', {
      paymentMethodId: paymentMethod.id,
      customerId: request.customerId,
      type: request.type,
    });

    return this.toResponse(paymentMethod);
  }

  async getById(id: string): Promise<PaymentMethodResponse | null> {
    const pm = await prisma.paymentMethod.findUnique({
      where: { id },
    });

    return pm ? this.toResponse(pm) : null;
  }

  async list(filter: ListPaymentMethodsFilter): Promise<PaymentMethodListResponse> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentMethodWhereInput = {};
    if (filter.customerId) where.customerId = filter.customerId;
    if (filter.type) where.type = filter.type;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    const [paymentMethods, total] = await Promise.all([
      prisma.paymentMethod.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.paymentMethod.count({ where }),
    ]);

    return {
      paymentMethods: paymentMethods.map((pm) => this.toResponse(pm)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(
    id: string,
    request: UpdatePaymentMethodRequest
  ): Promise<PaymentMethodResponse> {
    const existing = await prisma.paymentMethod.findUnique({
      where: { id },
    });

    if (!existing) {
      throw PaymentMethodError.notFound(id);
    }

    // If setting as default, unset other defaults for this customer
    if (request.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: {
          customerId: existing.customerId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.paymentMethod.update({
      where: { id },
      data: {
        ...(request.expiryMonth !== undefined && { expiryMonth: request.expiryMonth }),
        ...(request.expiryYear !== undefined && { expiryYear: request.expiryYear }),
        ...(request.holderName !== undefined && { holderName: request.holderName }),
        ...(request.isDefault !== undefined && { isDefault: request.isDefault }),
        ...(request.metadata !== undefined && { metadata: request.metadata as object }),
      },
    });

    logger.info('Payment method updated', { paymentMethodId: id });

    return this.toResponse(updated);
  }

  async deactivate(id: string): Promise<PaymentMethodResponse> {
    const existing = await prisma.paymentMethod.findUnique({
      where: { id },
    });

    if (!existing) {
      throw PaymentMethodError.notFound(id);
    }

    const updated = await prisma.paymentMethod.update({
      where: { id },
      data: { isActive: false, isDefault: false },
    });

    logger.info('Payment method deactivated', { paymentMethodId: id });

    return this.toResponse(updated);
  }

  private generateToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let token = 'tok_';
    for (let i = 0; i < 24; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private detectCardBrand(cardNumber?: string): string | null {
    if (!cardNumber) return null;
    const num = cardNumber.replace(/\s/g, '');
    if (num.startsWith('4')) return 'visa';
    if (/^5[1-5]/.test(num) || /^2[2-7]/.test(num)) return 'mastercard';
    if (num.startsWith('34') || num.startsWith('37')) return 'amex';
    if (num.startsWith('6011') || num.startsWith('65')) return 'discover';
    return 'unknown';
  }

  private toResponse(pm: {
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
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentMethodResponse {
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
      metadata: pm.metadata as Record<string, unknown>,
      createdAt: pm.createdAt,
      updatedAt: pm.updatedAt,
    };
  }
}

export const paymentMethodService = PaymentMethodService.getInstance();
