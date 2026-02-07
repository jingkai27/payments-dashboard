import { Currency, Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';
import {
  CreateMerchantRequest,
  UpdateMerchantRequest,
  MerchantResponse,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerResponse,
  ListMerchantsFilter,
  ListCustomersFilter,
  PaginatedResponse,
  MerchantError,
} from './merchant.types.js';

export class MerchantService {
  private static instance: MerchantService | null = null;

  private constructor() {}

  static getInstance(): MerchantService {
    if (!MerchantService.instance) {
      MerchantService.instance = new MerchantService();
    }
    return MerchantService.instance;
  }

  // ── Merchant CRUD ──

  async createMerchant(request: CreateMerchantRequest): Promise<MerchantResponse> {
    const existing = await prisma.merchant.findUnique({
      where: { email: request.email },
    });

    if (existing) {
      throw MerchantError.emailExists(request.email);
    }

    const merchant = await prisma.merchant.create({
      data: {
        name: request.name,
        legalName: request.legalName,
        email: request.email,
        defaultCurrency: request.defaultCurrency ?? 'USD',
        settings: (request.settings ?? {}) as object,
        metadata: (request.metadata ?? {}) as object,
      },
    });

    logger.info('Merchant created', { merchantId: merchant.id, email: merchant.email });

    return this.toMerchantResponse(merchant);
  }

  async getMerchant(id: string): Promise<MerchantResponse | null> {
    const merchant = await prisma.merchant.findUnique({ where: { id } });
    return merchant ? this.toMerchantResponse(merchant) : null;
  }

  async listMerchants(filter: ListMerchantsFilter): Promise<PaginatedResponse<MerchantResponse>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.MerchantWhereInput = {};
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    const [merchants, total] = await Promise.all([
      prisma.merchant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.merchant.count({ where }),
    ]);

    return {
      items: merchants.map((m) => this.toMerchantResponse(m)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateMerchant(id: string, request: UpdateMerchantRequest): Promise<MerchantResponse> {
    const existing = await prisma.merchant.findUnique({ where: { id } });
    if (!existing) {
      throw MerchantError.notFound(id);
    }

    if (request.email && request.email !== existing.email) {
      const emailTaken = await prisma.merchant.findUnique({
        where: { email: request.email },
      });
      if (emailTaken) {
        throw MerchantError.emailExists(request.email);
      }
    }

    const updated = await prisma.merchant.update({
      where: { id },
      data: {
        ...(request.name !== undefined && { name: request.name }),
        ...(request.legalName !== undefined && { legalName: request.legalName }),
        ...(request.email !== undefined && { email: request.email }),
        ...(request.defaultCurrency !== undefined && { defaultCurrency: request.defaultCurrency }),
        ...(request.settings !== undefined && { settings: request.settings as object }),
        ...(request.metadata !== undefined && { metadata: request.metadata as object }),
        ...(request.isActive !== undefined && { isActive: request.isActive }),
      },
    });

    logger.info('Merchant updated', { merchantId: id });

    return this.toMerchantResponse(updated);
  }

  // ── Customer CRUD ──

  async createCustomer(request: CreateCustomerRequest): Promise<CustomerResponse> {
    const merchant = await prisma.merchant.findUnique({
      where: { id: request.merchantId },
    });

    if (!merchant) {
      throw MerchantError.notFound(request.merchantId);
    }

    const customer = await prisma.customer.create({
      data: {
        merchantId: request.merchantId,
        externalId: request.externalId,
        email: request.email,
        name: request.name,
        metadata: (request.metadata ?? {}) as object,
      },
    });

    logger.info('Customer created', {
      customerId: customer.id,
      merchantId: request.merchantId,
    });

    return this.toCustomerResponse(customer);
  }

  async getCustomer(id: string): Promise<CustomerResponse | null> {
    const customer = await prisma.customer.findUnique({ where: { id } });
    return customer ? this.toCustomerResponse(customer) : null;
  }

  async listCustomers(filter: ListCustomersFilter): Promise<PaginatedResponse<CustomerResponse>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};
    if (filter.merchantId) where.merchantId = filter.merchantId;
    if (filter.email) where.email = filter.email;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      items: customers.map((c) => this.toCustomerResponse(c)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateCustomer(id: string, request: UpdateCustomerRequest): Promise<CustomerResponse> {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw MerchantError.customerNotFound(id);
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(request.email !== undefined && { email: request.email }),
        ...(request.name !== undefined && { name: request.name }),
        ...(request.metadata !== undefined && { metadata: request.metadata as object }),
        ...(request.isActive !== undefined && { isActive: request.isActive }),
      },
    });

    logger.info('Customer updated', { customerId: id });

    return this.toCustomerResponse(updated);
  }

  // ── Response Mappers ──

  private toMerchantResponse(m: {
    id: string;
    name: string;
    legalName: string;
    email: string;
    defaultCurrency: Currency;
    settings: unknown;
    metadata: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): MerchantResponse {
    return {
      id: m.id,
      name: m.name,
      legalName: m.legalName,
      email: m.email,
      defaultCurrency: m.defaultCurrency,
      settings: m.settings as Record<string, unknown>,
      metadata: m.metadata as Record<string, unknown>,
      isActive: m.isActive,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  private toCustomerResponse(c: {
    id: string;
    merchantId: string;
    externalId: string | null;
    email: string | null;
    name: string | null;
    metadata: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): CustomerResponse {
    return {
      id: c.id,
      merchantId: c.merchantId,
      externalId: c.externalId,
      email: c.email,
      name: c.name,
      metadata: c.metadata as Record<string, unknown>,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}

export const merchantService = MerchantService.getInstance();
