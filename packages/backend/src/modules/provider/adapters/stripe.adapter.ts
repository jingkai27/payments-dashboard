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

// Test card numbers for simulation
const TEST_CARDS = {
  SUCCESS: '4242424242424242',
  DECLINE_INSUFFICIENT_FUNDS: '4000000000009995',
  DECLINE_EXPIRED: '4000000000000069',
  DECLINE_CVV: '4000000000000127',
  DECLINE_GENERIC: '4000000000000002',
  NETWORK_ERROR: '4000000000000341',
  FRAUD: '4100000000000019',
};

// Virtual state for auth/capture flows
const virtualTransactions = new Map<
  string,
  {
    authorized: boolean;
    captured: boolean;
    cancelled: boolean;
    refundedAmount: bigint;
    amount: bigint;
    currency: Currency;
    createdAt: Date;
  }
>();

export class StripeAdapter extends BasePaymentProviderAdapter {
  readonly providerCode = 'stripe';
  readonly providerName = 'Stripe';
  readonly supportedCurrencies: Currency[] = [
    'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
  ];
  readonly supportedMethods: PaymentMethodType[] = ['CARD', 'DIGITAL_WALLET'];

  async authorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {
    this.ensureInitialized();
    await this.simulateLatency();

    const cardNumber = request.paymentMethod.cardNumber || '';
    const providerTransactionId = this.generateTransactionId();

    logger.debug('Stripe authorize request', {
      providerTransactionId,
      amount: request.amount.toString(),
      currency: request.currency,
      cardLastFour: cardNumber.slice(-4),
    });

    // Check for test card scenarios
    const response = this.handleTestCard(cardNumber, providerTransactionId, request);
    if (response) {
      return response;
    }

    // Store virtual transaction state
    virtualTransactions.set(providerTransactionId, {
      authorized: true,
      captured: request.capture ?? false,
      cancelled: false,
      refundedAmount: BigInt(0),
      amount: request.amount,
      currency: request.currency,
      createdAt: new Date(),
    });

    return {
      success: true,
      providerTransactionId,
      status: request.capture ? 'captured' : 'authorized',
      amount: request.amount,
      currency: request.currency,
      authorizationCode: `auth_${crypto.randomBytes(8).toString('hex')}`,
      avsResult: 'Y',
      cvvResult: 'M',
      rawResponse: {
        id: providerTransactionId,
        object: 'payment_intent',
        status: request.capture ? 'succeeded' : 'requires_capture',
      },
    };
  }

  async capture(request: CaptureRequest): Promise<CaptureResponse> {
    this.ensureInitialized();
    await this.simulateLatency();

    const txn = virtualTransactions.get(request.providerTransactionId);

    if (!txn) {
      throw new ProviderError(
        `Transaction ${request.providerTransactionId} not found`,
        'NOT_FOUND'
      );
    }

    if (!txn.authorized) {
      throw new ProviderError(
        'Transaction is not authorized',
        'INVALID_REQUEST'
      );
    }

    if (txn.captured) {
      throw new ProviderError(
        'Transaction already captured',
        'DUPLICATE_TRANSACTION'
      );
    }

    if (txn.cancelled) {
      throw new ProviderError(
        'Transaction was cancelled',
        'INVALID_REQUEST'
      );
    }

    const captureAmount = request.amount ?? txn.amount;

    if (captureAmount > txn.amount) {
      throw new ProviderError(
        'Capture amount exceeds authorized amount',
        'INVALID_REQUEST'
      );
    }

    txn.captured = true;

    logger.debug('Stripe capture completed', {
      providerTransactionId: request.providerTransactionId,
      capturedAmount: captureAmount.toString(),
    });

    return {
      success: true,
      providerTransactionId: request.providerTransactionId,
      capturedAmount: captureAmount,
      currency: txn.currency,
      rawResponse: {
        id: request.providerTransactionId,
        object: 'payment_intent',
        status: 'succeeded',
        amount_captured: Number(captureAmount),
      },
    };
  }

  async cancel(request: CancelRequest): Promise<CancelResponse> {
    this.ensureInitialized();
    await this.simulateLatency();

    const txn = virtualTransactions.get(request.providerTransactionId);

    if (!txn) {
      throw new ProviderError(
        `Transaction ${request.providerTransactionId} not found`,
        'NOT_FOUND'
      );
    }

    if (txn.captured) {
      throw new ProviderError(
        'Cannot cancel a captured transaction, use refund instead',
        'INVALID_REQUEST'
      );
    }

    if (txn.cancelled) {
      throw new ProviderError(
        'Transaction already cancelled',
        'DUPLICATE_TRANSACTION'
      );
    }

    txn.cancelled = true;

    logger.debug('Stripe cancel completed', {
      providerTransactionId: request.providerTransactionId,
    });

    return {
      success: true,
      providerTransactionId: request.providerTransactionId,
      rawResponse: {
        id: request.providerTransactionId,
        object: 'payment_intent',
        status: 'canceled',
      },
    };
  }

  async refund(request: RefundRequest): Promise<RefundResponse> {
    this.ensureInitialized();
    await this.simulateLatency();

    const txn = virtualTransactions.get(request.providerTransactionId);

    if (!txn) {
      throw new ProviderError(
        `Transaction ${request.providerTransactionId} not found`,
        'NOT_FOUND'
      );
    }

    if (!txn.captured) {
      throw new ProviderError(
        'Cannot refund an uncaptured transaction',
        'INVALID_REQUEST'
      );
    }

    const refundAmount = request.amount ?? txn.amount;
    const remainingAmount = txn.amount - txn.refundedAmount;

    if (refundAmount > remainingAmount) {
      throw new ProviderError(
        'Refund amount exceeds remaining balance',
        'INVALID_REQUEST'
      );
    }

    txn.refundedAmount += refundAmount;
    const refundId = `re_${crypto.randomBytes(12).toString('hex')}`;

    logger.debug('Stripe refund completed', {
      providerTransactionId: request.providerTransactionId,
      refundId,
      refundedAmount: refundAmount.toString(),
    });

    return {
      success: true,
      providerRefundId: refundId,
      refundedAmount: refundAmount,
      currency: txn.currency,
      status: 'completed',
      rawResponse: {
        id: refundId,
        object: 'refund',
        payment_intent: request.providerTransactionId,
        amount: Number(refundAmount),
        status: 'succeeded',
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
    // Stripe signature format: t=timestamp,v1=signature
    const parts = signature.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signaturePart = parts.find((p) => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const timestamp = timestampPart.split('=')[1];
    const providedSignature = signaturePart.split('=')[1];

    if (!timestamp || !providedSignature) {
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(providedSignature),
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
      'payment_intent.succeeded': 'captured',
      'payment_intent.payment_failed': 'failed',
      'payment_intent.canceled': 'cancelled',
      'charge.refunded': 'refunded',
    };

    return {
      eventType,
      providerTransactionId: data.id as string,
      status: statusMap[eventType],
      amount: data.amount ? BigInt(data.amount as number) : undefined,
      currency: data.currency as Currency | undefined,
    };
  }

  private handleTestCard(
    cardNumber: string,
    _providerTransactionId: string,
    _request: AuthorizeRequest
  ): AuthorizeResponse | null {
    switch (cardNumber) {
      case TEST_CARDS.DECLINE_INSUFFICIENT_FUNDS:
        throw ProviderError.insufficientFunds('Your card has insufficient funds');

      case TEST_CARDS.DECLINE_EXPIRED:
        throw ProviderError.expiredCard('Your card has expired');

      case TEST_CARDS.DECLINE_CVV:
        throw new ProviderError("Your card's security code is incorrect", 'INVALID_CVV');

      case TEST_CARDS.DECLINE_GENERIC:
        throw ProviderError.cardDeclined('Your card was declined');

      case TEST_CARDS.NETWORK_ERROR:
        throw ProviderError.networkError('Could not connect to payment network');

      case TEST_CARDS.FRAUD:
        throw new ProviderError('Transaction flagged as potentially fraudulent', 'FRAUD_SUSPECTED');

      case TEST_CARDS.SUCCESS:
      default:
        return null;
    }
  }
}
