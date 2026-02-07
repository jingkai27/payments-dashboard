import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { cacheService } from '../../shared/cache/cache.service.js';
import { logger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  FraudCheckRequest,
  FraudCheckResult,
  FraudFlag,
  FraudReviewAction,
  FlaggedTransaction,
  FlaggedTransactionsFilter,
} from './fraud.types.js';

const HIGH_AMOUNT_THRESHOLD = 500000; // $5000 in cents
const VELOCITY_THRESHOLD = 3; // max txns per minute from same IP
const VELOCITY_WINDOW_SECONDS = 60;

export class FraudService {
  private static instance: FraudService | null = null;

  private constructor() {}

  static getInstance(): FraudService {
    if (!FraudService.instance) {
      FraudService.instance = new FraudService();
    }
    return FraudService.instance;
  }

  async checkTransaction(request: FraudCheckRequest): Promise<FraudCheckResult> {
    logger.info('Running fraud check', { transactionId: request.transactionId });

    const flags: FraudFlag[] = [];
    const now = new Date().toISOString();

    // Rule 1: High amount
    if (request.amount > HIGH_AMOUNT_THRESHOLD) {
      flags.push({
        rule: 'HIGH_AMOUNT',
        description: `Transaction amount ${request.amount} exceeds threshold of ${HIGH_AMOUNT_THRESHOLD}`,
        severity: 'high',
        triggeredAt: now,
      });
    }

    // Rule 2: Velocity check (>3 txns/minute from same IP)
    if (request.ip) {
      const velocityKey = `fraud:velocity:${request.ip}`;
      const count = await cacheService.increment(velocityKey);
      if (count === 1) {
        await cacheService.setExpiry(velocityKey, VELOCITY_WINDOW_SECONDS);
      }
      if (count !== null && count > VELOCITY_THRESHOLD) {
        flags.push({
          rule: 'VELOCITY_EXCEEDED',
          description: `${count} transactions from IP ${request.ip} in the last minute (threshold: ${VELOCITY_THRESHOLD})`,
          severity: 'medium',
          triggeredAt: now,
        });
      }
    }

    // Calculate risk score
    let riskScore = 0;
    if (flags.length === 1) riskScore = 50;
    if (flags.length >= 2) riskScore = 90;

    const isFlagged = flags.length > 0;

    // Store flags in transaction metadata
    if (isFlagged) {
      await prisma.transaction.update({
        where: { id: request.transactionId },
        data: {
          metadata: JSON.parse(JSON.stringify({
            fraudFlags: flags,
            riskScore,
            fraudCheckedAt: now,
          })),
        },
      });
      logger.warn('Transaction flagged for fraud', {
        transactionId: request.transactionId,
        riskScore,
        flagCount: flags.length,
      });
    }

    return {
      transactionId: request.transactionId,
      riskScore,
      isFlagged,
      flags,
      checkedAt: now,
    };
  }

  async getFlaggedTransactions(filter: FlaggedTransactionsFilter): Promise<{
    transactions: FlaggedTransaction[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      metadata: {
        path: ['fraudFlags'],
        not: Prisma.DbNull,
      },
    };

    if (filter.status) {
      where.status = filter.status as Prisma.EnumTransactionStatusFilter;
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

    let flagged: FlaggedTransaction[] = transactions.map((t) => {
      const meta = t.metadata as Record<string, unknown> | null;
      return {
        id: t.id,
        transactionId: t.id,
        amount: t.amount.toString(),
        currency: t.currency,
        status: t.status,
        riskScore: (meta?.riskScore as number) ?? 0,
        flags: (meta?.fraudFlags as FraudFlag[]) ?? [],
        createdAt: t.createdAt.toISOString(),
      };
    });

    if (filter.minRiskScore !== undefined) {
      flagged = flagged.filter((t) => t.riskScore >= filter.minRiskScore!);
    }

    return {
      transactions: flagged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async reviewTransaction(
    transactionId: string,
    action: FraudReviewAction,
    reason?: string,
    reviewedBy?: string
  ): Promise<{ transactionId: string; action: FraudReviewAction; newStatus: string }> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw AppError.notFound(`Transaction ${transactionId} not found`);
    }

    const meta = transaction.metadata as Record<string, unknown> | null;
    if (!meta?.fraudFlags) {
      throw AppError.badRequest(`Transaction ${transactionId} has no fraud flags`);
    }

    const newStatus = action === 'approve' ? 'COMPLETED' : 'FAILED';

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: newStatus,
        metadata: {
          ...(meta ?? {}),
          fraudReview: {
            action,
            reason,
            reviewedBy,
            reviewedAt: new Date().toISOString(),
          },
        },
      },
    });

    logger.info('Fraud review completed', {
      transactionId,
      action,
      newStatus,
      reviewedBy,
    });

    return { transactionId, action, newStatus };
  }
}

export const fraudService = FraudService.getInstance();
