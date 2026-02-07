import { Currency } from '@prisma/client';

export interface CreateMerchantRequest {
  name: string;
  legalName: string;
  email: string;
  defaultCurrency?: Currency;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateMerchantRequest {
  name?: string;
  legalName?: string;
  email?: string;
  defaultCurrency?: Currency;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface MerchantResponse {
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
}

export interface CreateCustomerRequest {
  merchantId: string;
  externalId?: string;
  email?: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCustomerRequest {
  email?: string;
  name?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface CustomerResponse {
  id: string;
  merchantId: string;
  externalId: string | null;
  email: string | null;
  name: string | null;
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListMerchantsFilter {
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface ListCustomersFilter {
  merchantId?: string;
  email?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class MerchantError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'MerchantError';
    this.code = code;
  }

  static notFound(id: string): MerchantError {
    return new MerchantError(`Merchant ${id} not found`, 'NOT_FOUND');
  }

  static emailExists(email: string): MerchantError {
    return new MerchantError(
      `Merchant with email ${email} already exists`,
      'EMAIL_EXISTS'
    );
  }

  static customerNotFound(id: string): MerchantError {
    return new MerchantError(`Customer ${id} not found`, 'CUSTOMER_NOT_FOUND');
  }
}
