import { Transaction, TransactionStatus, TransactionType, Currency, Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';
import { providerService } from '../provider/provider.service.js';
import { fxService } from '../fx/fx.service.js';
import { routingService } from '../routing/routing.service.js';
import {
  CreatePaymentRequest,
  PaymentResponse,
  CapturePaymentRequest,
  RefundPaymentRequest,
  ListPaymentsFilter,
  PaymentListResponse,
  PaymentError,
} from './payment.types.js';
import { ProviderError, AuthorizeRequest } from '../provider/provider.types.js';
import { RoutingContext } from '../routing/routing.types.js';

const MAX_PROVIDER_RETRIES = 3;

export class PaymentService {
  private static instance: PaymentService | null = null;

  private constructor() {}

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    logger.info('Creating payment', {
      merchantId: request.merchantId,
      amount: request.amount.toString(),
      currency: request.currency,
    });

    // Check for idempotency
    if (request.idempotencyKey) {
      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey: request.idempotencyKey },
      });

      if (existing) {
        logger.info('Returning existing transaction for idempotency key', {
          transactionId: existing.id,
          idempotencyKey: request.idempotencyKey,
        });
        return this.toPaymentResponse(existing);
      }
    }

    // Handle FX conversion if needed
    let convertedAmount: bigint | undefined;
    let convertedCurrency: Currency | undefined;
    let fxRateId: string | undefined;

    if (request.targetCurrency && request.targetCurrency !== request.currency) {
      const conversion = await fxService.convert(
        request.amount,
        request.currency,
        request.targetCurrency
      );
      convertedAmount = conversion.targetAmount;
      convertedCurrency = request.targetCurrency;
      fxRateId = conversion.fxRateId;
    }

    // Build routing context
    const routingContext: RoutingContext = {
      merchantId: request.merchantId,
      amount: convertedAmount ?? request.amount,
      currency: convertedCurrency ?? request.currency,
      paymentMethodType: request.paymentMethod.type,
      customerId: request.customerId,
      metadata: request.metadata,
    };

    // Get routing decision
    const routingDecision = await routingService.selectProvider(routingContext);

    // Create initial transaction record
    const transaction = await prisma.transaction.create({
      data: {
        merchantId: request.merchantId,
        customerId: request.customerId,
        type: TransactionType.PAYMENT,
        status: TransactionStatus.PENDING,
        amount: request.amount,
        currency: request.currency,
        convertedAmount,
        convertedCurrency,
        fxRateId,
        description: request.description,
        metadata: (request.metadata ?? {}) as object,
        idempotencyKey: request.idempotencyKey,
      },
    });

    // Record status history
    await this.recordStatusChange(transaction.id, null, TransactionStatus.PENDING);

    // Attempt payment with fallback
    const failedProviderIds: string[] = [];
    let lastError: Error | null = null;

    const allProviderIds = [
      routingDecision.selectedProviderId,
      ...routingDecision.fallbackProviderIds,
    ];

    for (let attempt = 0; attempt < Math.min(allProviderIds.length, MAX_PROVIDER_RETRIES); attempt++) {
      const providerId = allProviderIds[attempt]!;

      try {
        const result = await this.executePaymentWithProvider(
          transaction.id,
          providerId,
          request,
          convertedAmount ?? request.amount,
          convertedCurrency ?? request.currency
        );
        return result;
      } catch (error) {
        lastError = error as Error;
        failedProviderIds.push(providerId);

        const isRetryable =
          error instanceof ProviderError && error.isRetryable;

        logger.warn('Payment attempt failed', {
          transactionId: transaction.id,
          providerId,
          attempt: attempt + 1,
          isRetryable,
          error: (error as Error).message,
        });

        if (!isRetryable) {
          break;
        }
      }
    }

    // All providers failed
    await this.updateTransactionStatus(
      transaction.id,
      TransactionStatus.FAILED,
      lastError?.message ?? 'All payment providers failed'
    );

    throw PaymentError.allProvidersFailed(transaction.id);
  }

  async getPayment(id: string): Promise<PaymentResponse | null> {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    return transaction ? this.toPaymentResponse(transaction) : null;
  }

  async listPayments(query: ListPaymentsFilter): Promise<PaymentListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};

    if (query.merchantId) where.merchantId = query.merchantId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.currency) where.currency = query.currency;
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = query.fromDate;
      if (query.toDate) where.createdAt.lte = query.toDate;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      payments: transactions.map((t) => this.toPaymentResponse(t)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async capturePayment(
    id: string,
    request: CapturePaymentRequest
  ): Promise<PaymentResponse> {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw PaymentError.notFound(id);
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw PaymentError.invalidStatus(id, transaction.status, 'PENDING');
    }

    if (!transaction.providerId || !transaction.providerTransactionId) {
      throw PaymentError.invalidRequest('Transaction has no provider');
    }

    const provider = await prisma.paymentProvider.findUnique({
      where: { id: transaction.providerId },
    });

    if (!provider) {
      throw PaymentError.providerError('Provider not found', id);
    }

    const adapter = await providerService.getAdapter(
      provider.code,
      transaction.merchantId
    );

    try {
      const captureResult = await adapter.capture({
        providerTransactionId: transaction.providerTransactionId,
        amount: request.amount,
        currency: transaction.currency,
      });

      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          status: TransactionStatus.COMPLETED,
          capturedAt: new Date(),
          providerResponse: captureResult.rawResponse as object,
        },
      });

      await this.recordStatusChange(id, TransactionStatus.PENDING, TransactionStatus.COMPLETED);

      // Update provider metrics
      await providerService.updateMetrics(transaction.providerId, true, 0);

      logger.info('Payment captured successfully', {
        transactionId: id,
        capturedAmount: captureResult.capturedAmount.toString(),
      });

      return this.toPaymentResponse(updated);
    } catch (error) {
      logger.error('Failed to capture payment', {
        transactionId: id,
        error: (error as Error).message,
      });

      if (error instanceof ProviderError) {
        throw PaymentError.providerError(error.message, id);
      }
      throw error;
    }
  }

  async cancelPayment(id: string, reason?: string): Promise<PaymentResponse> {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw PaymentError.notFound(id);
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw PaymentError.invalidStatus(id, transaction.status, 'PENDING');
    }

    if (!transaction.providerId || !transaction.providerTransactionId) {
      // No provider action needed, just update status
      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          status: TransactionStatus.CANCELLED,
          cancelledAt: new Date(),
          failureReason: reason,
        },
      });

      await this.recordStatusChange(id, TransactionStatus.PENDING, TransactionStatus.CANCELLED, reason);

      return this.toPaymentResponse(updated);
    }

    const provider = await prisma.paymentProvider.findUnique({
      where: { id: transaction.providerId },
    });

    if (!provider) {
      throw PaymentError.providerError('Provider not found', id);
    }

    const adapter = await providerService.getAdapter(
      provider.code,
      transaction.merchantId
    );

    try {
      await adapter.cancel({
        providerTransactionId: transaction.providerTransactionId,
        reason,
      });

      const updated = await prisma.transaction.update({
        where: { id },
        data: {
          status: TransactionStatus.CANCELLED,
          cancelledAt: new Date(),
          failureReason: reason,
        },
      });

      await this.recordStatusChange(id, TransactionStatus.PENDING, TransactionStatus.CANCELLED, reason);

      logger.info('Payment cancelled successfully', { transactionId: id });

      return this.toPaymentResponse(updated);
    } catch (error) {
      logger.error('Failed to cancel payment', {
        transactionId: id,
        error: (error as Error).message,
      });

      if (error instanceof ProviderError) {
        throw PaymentError.providerError(error.message, id);
      }
      throw error;
    }
  }

  async refundPayment(
    id: string,
    request: RefundPaymentRequest
  ): Promise<PaymentResponse> {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw PaymentError.notFound(id);
    }

    if (transaction.status !== TransactionStatus.COMPLETED) {
      throw PaymentError.invalidStatus(id, transaction.status, 'COMPLETED');
    }

    if (!transaction.providerId || !transaction.providerTransactionId) {
      throw PaymentError.invalidRequest('Transaction has no provider');
    }

    const provider = await prisma.paymentProvider.findUnique({
      where: { id: transaction.providerId },
    });

    if (!provider) {
      throw PaymentError.providerError('Provider not found', id);
    }

    const adapter = await providerService.getAdapter(
      provider.code,
      transaction.merchantId
    );

    try {
      const refundResult = await adapter.refund({
        providerTransactionId: transaction.providerTransactionId,
        amount: request.amount,
        currency: transaction.currency,
        reason: request.reason,
      });

      // Create refund transaction
      const refundTransaction = await prisma.transaction.create({
        data: {
          merchantId: transaction.merchantId,
          customerId: transaction.customerId,
          providerId: transaction.providerId,
          paymentMethodId: transaction.paymentMethodId,
          parentTransactionId: transaction.id,
          type: TransactionType.REFUND,
          status: refundResult.status === 'completed'
            ? TransactionStatus.COMPLETED
            : TransactionStatus.PENDING,
          amount: refundResult.refundedAmount,
          currency: refundResult.currency,
          providerTransactionId: refundResult.providerRefundId,
          providerResponse: refundResult.rawResponse as object,
          description: request.reason ?? 'Refund',
          metadata: {},
          refundedAt: refundResult.status === 'completed' ? new Date() : null,
        },
      });

      // Update original transaction if fully refunded
      const refundAmount = request.amount ?? transaction.amount;
      if (refundAmount >= transaction.amount) {
        await prisma.transaction.update({
          where: { id },
          data: {
            status: TransactionStatus.REFUNDED,
            refundedAt: new Date(),
          },
        });

        await this.recordStatusChange(id, TransactionStatus.COMPLETED, TransactionStatus.REFUNDED, request.reason);
      }

      logger.info('Payment refunded successfully', {
        transactionId: id,
        refundTransactionId: refundTransaction.id,
        refundedAmount: refundResult.refundedAmount.toString(),
      });

      return this.toPaymentResponse(refundTransaction);
    } catch (error) {
      logger.error('Failed to refund payment', {
        transactionId: id,
        error: (error as Error).message,
      });

      if (error instanceof ProviderError) {
        throw PaymentError.providerError(error.message, id);
      }
      throw error;
    }
  }

  private async executePaymentWithProvider(
    transactionId: string,
    providerId: string,
    request: CreatePaymentRequest,
    amount: bigint,
    currency: Currency
  ): Promise<PaymentResponse> {
    const provider = await prisma.paymentProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    // Update transaction with provider
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        providerId,
        status: TransactionStatus.PROCESSING,
      },
    });

    await this.recordStatusChange(transactionId, TransactionStatus.PENDING, TransactionStatus.PROCESSING);

    const adapter = await providerService.getAdapter(
      provider.code,
      request.merchantId
    );

    const startTime = Date.now();

    const authorizeRequest: AuthorizeRequest = {
      merchantId: request.merchantId,
      amount,
      currency,
      paymentMethod: request.paymentMethod,
      description: request.description,
      metadata: request.metadata,
      idempotencyKey: request.idempotencyKey,
      capture: request.capture ?? true,
      customerId: request.customerId,
    };

    try {
      const result = await adapter.authorize(authorizeRequest);
      const latency = Date.now() - startTime;

      const newStatus = result.status === 'captured' || result.status === 'authorized'
        ? result.status === 'captured'
          ? TransactionStatus.COMPLETED
          : TransactionStatus.PENDING
        : TransactionStatus.FAILED;

      const updated = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: newStatus,
          providerTransactionId: result.providerTransactionId,
          providerResponse: result.rawResponse as object,
          capturedAt: result.status === 'captured' ? new Date() : null,
          failureReason: result.declineReason,
        },
      });

      await this.recordStatusChange(transactionId, TransactionStatus.PROCESSING, newStatus);

      // Update provider metrics
      await providerService.updateMetrics(providerId, result.success, latency);

      logger.info('Payment processed successfully', {
        transactionId,
        providerId,
        providerTransactionId: result.providerTransactionId,
        status: newStatus,
        latency,
      });

      return this.toPaymentResponse(updated);
    } catch (error) {
      const latency = Date.now() - startTime;

      // Update provider metrics for failure
      await providerService.updateMetrics(providerId, false, latency);

      throw error;
    }
  }

  private async updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    failureReason?: string
  ): Promise<void> {
    const current = await prisma.transaction.findUnique({
      where: { id },
      select: { status: true },
    });

    await prisma.transaction.update({
      where: { id },
      data: { status, failureReason },
    });

    await this.recordStatusChange(id, current?.status ?? null, status, failureReason);
  }

  private async recordStatusChange(
    transactionId: string,
    fromStatus: TransactionStatus | null,
    toStatus: TransactionStatus,
    reason?: string
  ): Promise<void> {
    await prisma.transactionStatusHistory.create({
      data: {
        transactionId,
        fromStatus,
        toStatus,
        reason,
      },
    });
  }

  private toPaymentResponse(transaction: Transaction): PaymentResponse {
    return {
      id: transaction.id,
      merchantId: transaction.merchantId,
      customerId: transaction.customerId ?? undefined,
      providerId: transaction.providerId ?? undefined,
      providerTransactionId: transaction.providerTransactionId ?? undefined,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      convertedAmount: transaction.convertedAmount ?? undefined,
      convertedCurrency: transaction.convertedCurrency ?? undefined,
      description: transaction.description ?? undefined,
      failureReason: transaction.failureReason ?? undefined,
      metadata: transaction.metadata as Record<string, unknown>,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}

export const paymentService = PaymentService.getInstance();
