import { Currency, PaymentMethodType, ProviderStatus } from '@prisma/client';

// ============================================
// PROVIDER CORE TYPES
// ============================================

export interface ProviderConfig {
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  sandbox?: boolean;
  baseUrl?: string;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastCheck: Date;
  message?: string;
}

export interface ProviderMetrics {
  successRate: number;
  averageLatency: number;
  totalTransactions: number;
  failedTransactions: number;
  lastUpdated: Date;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface AuthorizeRequest {
  merchantId: string;
  amount: bigint;
  currency: Currency;
  paymentMethod: {
    type: PaymentMethodType;
    token?: string;
    cardNumber?: string;
    expiryMonth?: number;
    expiryYear?: number;
    cvv?: string;
    holderName?: string;
  };
  description?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  capture?: boolean;
  customerId?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
}

export interface AuthorizeResponse {
  success: boolean;
  providerTransactionId: string;
  status: 'authorized' | 'captured' | 'declined' | 'pending';
  amount: bigint;
  currency: Currency;
  authorizationCode?: string;
  avsResult?: string;
  cvvResult?: string;
  riskScore?: number;
  declineReason?: string;
  rawResponse?: unknown;
}

export interface CaptureRequest {
  providerTransactionId: string;
  amount?: bigint;
  currency?: Currency;
  metadata?: Record<string, unknown>;
}

export interface CaptureResponse {
  success: boolean;
  providerTransactionId: string;
  capturedAmount: bigint;
  currency: Currency;
  rawResponse?: unknown;
}

export interface CancelRequest {
  providerTransactionId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface CancelResponse {
  success: boolean;
  providerTransactionId: string;
  rawResponse?: unknown;
}

export interface RefundRequest {
  providerTransactionId: string;
  amount?: bigint;
  currency?: Currency;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundResponse {
  success: boolean;
  providerRefundId: string;
  refundedAmount: bigint;
  currency: Currency;
  status: 'pending' | 'completed' | 'failed';
  rawResponse?: unknown;
}

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// ============================================
// ERROR TYPES
// ============================================

export type ProviderErrorCode =
  | 'INSUFFICIENT_FUNDS'
  | 'EXPIRED_CARD'
  | 'INVALID_CARD'
  | 'INVALID_CVV'
  | 'CARD_DECLINED'
  | 'FRAUD_SUSPECTED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'AUTHENTICATION_ERROR'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'DUPLICATE_TRANSACTION'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

export class ProviderError extends Error {
  public readonly code: ProviderErrorCode;
  public readonly isRetryable: boolean;
  public readonly providerCode?: string;
  public readonly rawError?: unknown;

  constructor(
    message: string,
    code: ProviderErrorCode,
    options?: {
      isRetryable?: boolean;
      providerCode?: string;
      rawError?: unknown;
    }
  ) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.isRetryable = options?.isRetryable ?? this.determineRetryable(code);
    this.providerCode = options?.providerCode;
    this.rawError = options?.rawError;
  }

  private determineRetryable(code: ProviderErrorCode): boolean {
    const retryableCodes: ProviderErrorCode[] = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMITED',
      'PROVIDER_UNAVAILABLE',
    ];
    return retryableCodes.includes(code);
  }

  static insufficientFunds(message = 'Insufficient funds'): ProviderError {
    return new ProviderError(message, 'INSUFFICIENT_FUNDS');
  }

  static expiredCard(message = 'Card has expired'): ProviderError {
    return new ProviderError(message, 'EXPIRED_CARD');
  }

  static invalidCard(message = 'Invalid card number'): ProviderError {
    return new ProviderError(message, 'INVALID_CARD');
  }

  static cardDeclined(message = 'Card was declined'): ProviderError {
    return new ProviderError(message, 'CARD_DECLINED');
  }

  static networkError(message = 'Network error occurred'): ProviderError {
    return new ProviderError(message, 'NETWORK_ERROR', { isRetryable: true });
  }

  static timeout(message = 'Request timed out'): ProviderError {
    return new ProviderError(message, 'TIMEOUT', { isRetryable: true });
  }

  static providerUnavailable(message = 'Provider is unavailable'): ProviderError {
    return new ProviderError(message, 'PROVIDER_UNAVAILABLE', { isRetryable: true });
  }
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface WebhookPayload {
  eventType: string;
  providerEventId: string;
  providerTransactionId?: string;
  data: unknown;
  timestamp: Date;
  signature?: string;
}

export interface ProcessedWebhook {
  eventType: string;
  providerTransactionId?: string;
  status?: 'authorized' | 'captured' | 'refunded' | 'cancelled' | 'failed';
  amount?: bigint;
  currency?: Currency;
  metadata?: Record<string, unknown>;
}

// ============================================
// PROVIDER INFO TYPES
// ============================================

export interface ProviderInfo {
  id: string;
  name: string;
  code: string;
  status: ProviderStatus;
  supportedCurrencies: Currency[];
  supportedMethods: PaymentMethodType[];
  health?: ProviderHealth;
  metrics?: ProviderMetrics;
}
