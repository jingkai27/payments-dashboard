import { Currency, PaymentMethodType } from '@prisma/client';
import { BasePaymentProviderAdapter } from './base.adapter.js';
import {
  AuthorizeRequest,
  AuthorizeResponse,
  CaptureRequest,
  CaptureResponse,
  CancelRequest,
  CancelResponse,
  RefundRequest,
  RefundResponse,
  ProviderHealth,
  ProviderError,
  WebhookPayload,
  ProcessedWebhook,
} from '../provider.types.js';
import { logger } from '../../../shared/utils/logger.js';
import crypto from 'crypto';

// Test card numbers matching Stripe for consistency
const TEST_CARDS = {
  SUCCESS: '4242424242424242',
  DECLINE_INSUFFICIENT_FUNDS: '4000000000009995',
  DECLINE_EXPIRED: '4000000000000069',
  NETWORK_ERROR: '4000000000000341',
};

// Virtual state for PayPal orders
const virtualOrders = new Map<
  string,
  {
    status: 'CREATED' | 'APPROVED' | 'CAPTURED' | 'VOIDED';
    refundedAmount: bigint;
    amount: bigint;
    currency: Currency;
    createdAt: Date;
  }
>();

export class PayPalAdapter extends BasePaymentProviderAdapter {
  readonly providerCode = 'paypal';
  readonly providerName = 'PayPal';
  readonly supportedCurrencies: Currency[] = [
    'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'JPY', 'SGD', 'HKD',
  ];
  readonly supportedMethods: PaymentMethodType[] = ['CARD', 'DIGITAL_WALLET'];

  async authorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
    this.ensureInitialized();
    await this.simulateLatency();

    const cardNumber = request.paymentMethod.cardNumber || '';
    const orderId = this.generateOrderId();

    logger.debug('PayPal authorize request', {
      orderId,
      amount: request.amount.toString(),
      currency: request.currency,
    });

    // Check for test card scenarios
    this.handleTestCard(cardNumber);

    // Store virtual order state
    virtualOrders.set(orderId, {
      status: request.capture ? 'CAPTURED' : 'APPROVED',
      refundedAmount: BigInt(0),
      amount: request.amount,
      currency: request.currency,
      createdAt: new Date(),
    });

    return {
      success: true,
      providerTransactionId: orderId,
      status: request.capture ? 'captured' : 'authorized',
      amount: request.amount,
      currency: request.currency,
      authorizationCode: `PAYPAL-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      rawResponse: {
        id: orderId,
        intent: request.capture ? 'CAPTURE' : 'AUTHORIZE',
        status: request.capture ? 'COMPLETED' : 'APPROVED',
        purchase_units: [
          {
            amount: {
              currency_code: request.currency,
              value: (Number(request.amount) / 100).toFixed(2),
            },
          },
        ],
      },
    };
  }

  async capture(request: CaptureRequest): Promise<CaptureResponse> {
    this.ensureInitialized();
    await this.simulateLatency();

    const order = virtualOrders.get(request.providerTransactionId);

    if (!order) {
      throw new ProviderError(
        `Order ${request.providerTransactionId} not found`,
        'NOT_FOUND'
      );
    }

    if (order.status === 'CAPTURED') {
      throw new ProviderError(
        'Order already captured',
        'DUPLICATE_TRANSACTION'
      );
    }

    if (order.status === 'VOIDED') {
      throw new ProviderError(
        'Order was voided',
        'INVALID_REQUEST'
      );
    }

    const captureAmount = request.amount ?? order.amount;

    if (captureAmount > order.amount) {
      throw new ProviderError(
        'Capture amount exceeds authorized amount',
        'INVALID_REQUEST'
      );
    }

    order.status = 'CAPTURED';

    const captureId = `CAPTURE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    logger.debug('PayPal capture completed', {
      orderId: request.providerTransactionId,
      captureId,
      capturedAmount: captureAmount.toString(),
    });

    return {
      success: true,
      providerTransactionId: captureId,
      capturedAmount: captureAmount,
      currency: order.currency,
      rawResponse: {
        id: captureId,
        status: 'COMPLETED',
        amount: {
          currency_code: order.currency,
          value: (Number(captureAmount) / 100).toFixed(2),
        },
      },
    };
  }

  async cancel(request: CancelRequest): Promise<CancelResponse> {
    this.ensureInitialized();
    await this.simulateLatency();

    const order = virtualOrders.get(request.providerTransactionId);

    if (!order) {
      throw new ProviderError(
        `Order ${request.providerTransactionId} not found`,
        'NOT_FOUND'
      );
    }

    if (order.status === 'CAPTURED') {
      throw new ProviderError(
        'Cannot void a captured order, use refund instead',
        'INVALID_REQUEST'
      );
    }

    if (order.status === 'VOIDED') {
      throw new ProviderError(
        'Order already voided',
        'DUPLICATE_TRANSACTION'
      );
    }

    order.status = 'VOIDED';

    logger.debug('PayPal void completed', {
      orderId: request.providerTransactionId,
    });

    return {
      success: true,
      providerTransactionId: request.providerTransactionId,
      rawResponse: {
        id: request.providerTransactionId,
        status: 'VOIDED',
      },
    };
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    this.ensureInitialized();
    await this.simulateLatency();

    const order = virtualOrders.get(request.providerTransactionId);

    if (!order) {
      throw new ProviderError(
        `Order ${request.providerTransactionId} not found`,
        'NOT_FOUND'
      );
    }

    if (order.status !== 'CAPTURED') {
      throw new ProviderError(
        'Can only refund captured orders',
        'INVALID_REQUEST'
      );
    }

    const refundAmount = request.amount ?? order.amount;
    const remainingAmount = order.amount - order.refundedAmount;

    if (refundAmount > remainingAmount) {
      throw new ProviderError(
        'Refund amount exceeds remaining balance',
        'INVALID_REQUEST'
      );
    }

    order.refundedAmount += refundAmount;
    const refundId = `REFUND-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    logger.debug('PayPal refund completed', {
      orderId: request.providerTransactionId,
      refundId,
      refundedAmount: refundAmount.toString(),
    });

    return {
      success: true,
      providerRefundId: refundId,
      refundedAmount: refundAmount,
      currency: order.currency,
      status: 'completed',
      rawResponse: {
        id: refundId,
        status: 'COMPLETED',
        amount: {
          currency_code: order.currency,
          value: (Number(refundAmount) / 100).toFixed(2),
        },
      },
    };
  }

  async checkHealth(): Promise<ProviderHealth> {
    const start = Date.now();
    await this.simulateLatency();
    const latency = Date.now() - start;

    // Simulate random degradation for testing
    const failureRate = (this.config.metadata?.failureRate as number) || 0;
    if (Math.random() < failureRate) {
      return {
        status: 'degraded',
        latency,
        lastCheck: new Date(),
        message: 'Simulated degradation',
      };
    }

    return {
      status: 'healthy',
      latency,
      lastCheck: new Date(),
    };
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // PayPal uses a different signature verification approach
    // For simulation, we do a simple HMAC verification
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  async parseWebhook(payload: WebhookPayload): Promise<ProcessedWebhook> {
    const data = payload.data as Record<string, unknown>;
    const eventType = payload.eventType;

    const statusMap: Record<string, ProcessedWebhook['status']> = {
      'PAYMENT.CAPTURE.COMPLETED': 'captured',
      'PAYMENT.CAPTURE.DENIED': 'failed',
      'PAYMENT.AUTHORIZATION.VOIDED': 'cancelled',
      'PAYMENT.CAPTURE.REFUNDED': 'refunded',
    };

    const resource = data.resource as Record<string, unknown> | undefined;

    const amountObj = resource?.amount as Record<string, string> | undefined;
    const amountValue = amountObj?.value;
    const currencyCode = amountObj?.currency_code;

    return {
      eventType,
      providerTransactionId: resource?.id as string | undefined,
      status: statusMap[eventType],
      amount: amountValue
        ? BigInt(Math.round(parseFloat(amountValue) * 100))
        : undefined,
      currency: currencyCode as Currency | undefined,
    };
  }

  private generateOrderId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(8).toString('hex').toUpperCase();
    return `${timestamp}${random}`;
  }

  private handleTestCard(cardNumber: string): void {
    switch (cardNumber) {
      case TEST_CARDS.DECLINE_INSUFFICIENT_FUNDS:
        throw ProviderError.insufficientFunds('Transaction declined - insufficient funds');

      case TEST_CARDS.DECLINE_EXPIRED:
        throw ProviderError.expiredCard('The card has expired');

      case TEST_CARDS.NETWORK_ERROR:
        throw ProviderError.networkError('Network error - please try again');

      case TEST_CARDS.SUCCESS:
      default:
        return;
    }
  }
}
