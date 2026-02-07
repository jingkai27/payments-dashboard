import { WebhookEventStatus, TransactionStatus } from '@prisma/client';
import { prisma } from '../../../shared/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import { WebhookPayload, ProcessedWebhook } from '../provider.types.js';
import { AdapterFactory } from '../adapters/adapter.factory.js';

export abstract class BaseWebhookHandler {
  protected abstract providerCode: string;

  async handleWebhook(
    rawPayload: string,
    signature: string,
    headers: Record<string, string>
  ): Promise<{ success: boolean; eventId?: string }> {
    // Get provider
    const provider = await prisma.paymentProvider.findUnique({
      where: { code: this.providerCode },
    });

    if (!provider) {
      throw new Error(`Provider ${this.providerCode} not found`);
    }

    // Get adapter and verify signature
    const adapter = await AdapterFactory.getAdapter(this.providerCode);
    const webhookSecret = provider.config &&
      typeof provider.config === 'object' &&
      'webhookSecret' in provider.config
        ? (provider.config as { webhookSecret: string }).webhookSecret
        : '';

    if (webhookSecret && !adapter.verifyWebhookSignature(rawPayload, signature, webhookSecret)) {
      logger.warn('Invalid webhook signature', { providerCode: this.providerCode });
      throw new Error('Invalid webhook signature');
    }

    // Parse payload
    const payload = this.parseRawPayload(rawPayload, headers);

    // Create webhook event record
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        providerId: provider.id,
        eventType: payload.eventType,
        status: WebhookEventStatus.RECEIVED,
        payload: payload.data as object,
        headers,
        signature,
      },
    });

    try {
      // Process the webhook
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: WebhookEventStatus.PROCESSING },
      });

      const processed = await adapter.parseWebhook(payload);
      await this.processWebhook(processed);

      // Mark as processed
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: WebhookEventStatus.PROCESSED,
          processedAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      logger.info('Webhook processed successfully', {
        webhookEventId: webhookEvent.id,
        eventType: payload.eventType,
        providerCode: this.providerCode,
      });

      return { success: true, eventId: webhookEvent.id };
    } catch (error) {
      // Mark as failed
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: WebhookEventStatus.FAILED,
          lastError: (error as Error).message,
          attempts: { increment: 1 },
        },
      });

      logger.error('Webhook processing failed', {
        webhookEventId: webhookEvent.id,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  protected async processWebhook(processed: ProcessedWebhook): Promise<void> {
    if (!processed.providerTransactionId) {
      logger.debug('Webhook has no transaction ID, skipping', {
        eventType: processed.eventType,
      });
      return;
    }

    // Find the transaction
    const transaction = await prisma.transaction.findFirst({
      where: { providerTransactionId: processed.providerTransactionId },
    });

    if (!transaction) {
      logger.warn('Transaction not found for webhook', {
        providerTransactionId: processed.providerTransactionId,
      });
      return;
    }

    // Map webhook status to transaction status
    const statusMap: Record<string, TransactionStatus> = {
      captured: TransactionStatus.COMPLETED,
      authorized: TransactionStatus.PENDING,
      refunded: TransactionStatus.REFUNDED,
      cancelled: TransactionStatus.CANCELLED,
      failed: TransactionStatus.FAILED,
    };

    const newStatus = processed.status ? statusMap[processed.status] : undefined;

    if (newStatus && newStatus !== transaction.status) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: newStatus,
          ...(newStatus === TransactionStatus.COMPLETED ? { capturedAt: new Date() } : {}),
          ...(newStatus === TransactionStatus.REFUNDED ? { refundedAt: new Date() } : {}),
          ...(newStatus === TransactionStatus.CANCELLED ? { cancelledAt: new Date() } : {}),
        },
      });

      await prisma.transactionStatusHistory.create({
        data: {
          transactionId: transaction.id,
          fromStatus: transaction.status,
          toStatus: newStatus,
          reason: `Webhook: ${processed.eventType}`,
        },
      });

      logger.info('Transaction status updated via webhook', {
        transactionId: transaction.id,
        fromStatus: transaction.status,
        toStatus: newStatus,
        eventType: processed.eventType,
      });
    }
  }

  protected abstract parseRawPayload(
    rawPayload: string,
    headers: Record<string, string>
  ): WebhookPayload;
}
