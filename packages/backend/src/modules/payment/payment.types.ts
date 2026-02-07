import { Currency, PaymentMethodType, TransactionStatus, TransactionType } from '@prisma/client';

export interface CreatePaymentRequest {
  merchantId: string;
  customerId?: string;
  amount: bigint;
  currency: Currency;
  targetCurrency?: Currency;
  paymentMethod: {
    type: PaymentMethodType;
    token?: string;
    cardNumber?: string;
    expiryMonth?: number;
    expiryYear?: number;
    cvv?: string;
    holderName?: string;
  };
  capture?: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface PaymentResponse {
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
}

export interface CapturePaymentRequest {
  amount?: bigint;
}

export interface RefundPaymentRequest {
  amount?: bigint;
  reason?: string;
}

export interface ListPaymentsFilter {
  merchantId?: string;
  customerId?: string;
  status?: TransactionStatus;
  type?: TransactionType;
  currency?: Currency;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

export interface PaymentListResponse {
  payments: PaymentResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class PaymentError extends Error {
  public readonly code: string;
  public readonly transactionId?: string;

  constructor(message: string, code: string, transactionId?: string) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.transactionId = transactionId;
  }

  static invalidRequest(message: string): PaymentError {
    return new PaymentError(message, 'INVALID_REQUEST');
  }

  static notFound(transactionId: string): PaymentError {
    return new PaymentError(
      `Transaction ${transactionId} not found`,
      'NOT_FOUND',
      transactionId
    );
  }

  static invalidStatus(
    transactionId: string,
    currentStatus: string,
    requiredStatus: string
  ): PaymentError {
    return new PaymentError(
      `Transaction ${transactionId} is ${currentStatus}, expected ${requiredStatus}`,
      'INVALID_STATUS',
      transactionId
    );
  }

  static providerError(message: string, transactionId?: string): PaymentError {
    return new PaymentError(message, 'PROVIDER_ERROR', transactionId);
  }

  static allProvidersFailed(transactionId?: string): PaymentError {
    return new PaymentError(
      'All payment providers failed',
      'ALL_PROVIDERS_FAILED',
      transactionId
    );
  }
}
