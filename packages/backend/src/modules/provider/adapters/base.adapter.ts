import { Currency, PaymentMethodType } from '@prisma/client';
import {
  AuthorizeRequest,
  AuthorizeResponse,
  CaptureRequest,
  CaptureResponse,
  CancelRequest,
  CancelResponse,
  RefundRequest,
  RefundResponse,
  ProviderConfig,
  ProviderHealth,
  WebhookPayload,
  ProcessedWebhook,
} from '../provider.types.js';

export interface IPaymentProviderAdapter {
  readonly providerCode: string;
  readonly providerName: string;
  readonly supportedCurrencies: Currency[];
  readonly supportedMethods: PaymentMethodType[];

  initialize(config: ProviderConfig): Promise<void>;

  authorize(request: AuthorizeRequest): Promise<AuthorizeResponse>;
  capture(request: CaptureRequest): Promise<CaptureResponse>;
  cancel(request: CancelRequest): Promise<CancelResponse>;
  refund(request: RefundRequest): Promise<RefundResponse>;

  checkHealth(): Promise<ProviderHealth>;

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  parseWebhook(payload: WebhookPayload): Promise<ProcessedWebhook>;

  supportsMethod(method: PaymentMethodType): boolean;
  supportsCurrency(currency: Currency): boolean;
}

export abstract class BasePaymentProviderAdapter implements IPaymentProviderAdapter {
  abstract readonly providerCode: string;
  abstract readonly providerName: string;
  abstract readonly supportedCurrencies: Currency[];
  abstract readonly supportedMethods: PaymentMethodType[];

  protected config: ProviderConfig = {};
  protected isInitialized = false;

  async initialize(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.isInitialized = true;
  }

  abstract authorize(request: AuthorizeRequest): Promise<AuthorizeResponse>;
  abstract capture(request: CaptureRequest): Promise<CaptureResponse>;
  abstract cancel(request: CancelRequest): Promise<CancelResponse>;
  abstract refund(request: RefundRequest): Promise<RefundResponse>;
  abstract checkHealth(): Promise<ProviderHealth>;

  verifyWebhookSignature(_payload: string, _signature: string, _secret: string): boolean {
    return true;
  }

  async parseWebhook(payload: WebhookPayload): Promise<ProcessedWebhook> {
    return {
      eventType: payload.eventType,
      providerTransactionId: payload.providerTransactionId,
    };
  }

  supportsMethod(method: PaymentMethodType): boolean {
    return this.supportedMethods.includes(method);
  }

  supportsCurrency(currency: Currency): boolean {
    return this.supportedCurrencies.includes(currency);
  }

  protected generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${this.providerCode}_${timestamp}_${random}`;
  }

  protected async simulateLatency(): Promise<void> {
    const latencyMs = this.config.metadata?.simulateLatencyMs as number;
    if (latencyMs && latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }
  }

  protected ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(`Provider ${this.providerCode} is not initialized`);
    }
  }
}
