import { PaymentMethodType } from '@prisma/client';

export interface CreatePaymentMethodRequest {
  customerId: string;
  type: PaymentMethodType;
  token?: string;
  cardNumber?: string;
  expiryMonth?: number;
  expiryYear?: number;
  cvv?: string;
  holderName?: string;
  brand?: string;
  bankName?: string;
  walletProvider?: string;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdatePaymentMethodRequest {
  expiryMonth?: number;
  expiryYear?: number;
  holderName?: string;
  isDefault?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PaymentMethodResponse {
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
}

export interface ListPaymentMethodsFilter {
  customerId?: string;
  type?: PaymentMethodType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface PaymentMethodListResponse {
  paymentMethods: PaymentMethodResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class PaymentMethodError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'PaymentMethodError';
    this.code = code;
  }

  static notFound(id: string): PaymentMethodError {
    return new PaymentMethodError(
      `Payment method ${id} not found`,
      'NOT_FOUND'
    );
  }

  static customerNotFound(customerId: string): PaymentMethodError {
    return new PaymentMethodError(
      `Customer ${customerId} not found`,
      'CUSTOMER_NOT_FOUND'
    );
  }

  static invalidCard(message: string): PaymentMethodError {
    return new PaymentMethodError(message, 'INVALID_CARD');
  }

  static alreadyExists(customerId: string, type: string): PaymentMethodError {
    return new PaymentMethodError(
      `A ${type} payment method already exists for customer ${customerId}`,
      'ALREADY_EXISTS'
    );
  }
}
