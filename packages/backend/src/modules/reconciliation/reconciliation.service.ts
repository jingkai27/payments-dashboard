import { prisma } from '../../shared/database/prisma.js';
import { logger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  SettlementRecord,
  MockSettlementRequest,
  Discrepancy,
  DiscrepancyType,
  DiscrepancyResolution,
  ReconcileRequest,
  ReconciliationReportSummary,
  ReconciliationReportDetail,
} from './reconciliation.types.js';

export class ReconciliationService {
  private static instance: ReconciliationService | null = null;

  private constructor() {}

  static getInstance(): ReconciliationService {
    if (!ReconciliationService.instance) {
      ReconciliationService.instance = new ReconciliationService();
    }
    return ReconciliationService.instance;
  }

  async generateMockSettlement(request: MockSettlementRequest): Promise<{
    records: SettlementRecord[];
    csv?: string;
  }> {
    logger.info('Generating mock settlement', { request });

    const transactions = await prisma.transaction.findMany({
      where: {
        merchantId: request.merchantId,
        providerId: request.providerId,
        createdAt: {
          gte: new Date(request.fromDate),
          lte: new Date(request.toDate),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let records: SettlementRecord[] = transactions.map((t) => ({
      transactionId: t.id,
      amount: Number(t.amount),
      currency: t.currency,
      status: t.status,
      providerRef: t.providerTransactionId ?? undefined,
      settledAt: t.updatedAt.toISOString(),
    }));

    if (request.introduceDiscrepancies && records.length > 0) {
      records = this.addDiscrepancies(records);
    }

    if (request.format === 'csv') {
      const csv = this.toCsv(records);
      return { records, csv };
    }

    return { records };
  }

  async reconcile(request: ReconcileRequest): Promise<ReconciliationReportDetail> {
    logger.info('Starting reconciliation', {
      merchantId: request.merchantId,
      settlementCount: request.settlementData.length,
    });

    const localTransactions = await prisma.transaction.findMany({
      where: {
        merchantId: request.merchantId,
        providerId: request.providerId,
        createdAt: {
          gte: new Date(request.fromDate),
          lte: new Date(request.toDate),
        },
      },
    });

    const localMap = new Map(localTransactions.map((t) => [t.id, t]));
    const providerMap = new Map(request.settlementData.map((r) => [r.transactionId, r]));

    const discrepancies: Discrepancy[] = [];
    let matched = 0;
    let discrepancyIdx = 0;

    // Check provider records against local DB
    for (const providerRecord of request.settlementData) {
      const localTxn = localMap.get(providerRecord.transactionId);
      if (!localTxn) {
        discrepancies.push({
          id: `disc_${discrepancyIdx++}`,
          transactionId: providerRecord.transactionId,
          type: 'MISSING_IN_DB' as DiscrepancyType,
          providerAmount: providerRecord.amount,
          providerStatus: providerRecord.status,
          description: `Transaction ${providerRecord.transactionId} exists in provider settlement but not in local DB`,
        });
        continue;
      }

      let hasDiscrepancy = false;

      if (Number(localTxn.amount) !== providerRecord.amount) {
        discrepancies.push({
          id: `disc_${discrepancyIdx++}`,
          transactionId: providerRecord.transactionId,
          type: 'AMOUNT_MISMATCH' as DiscrepancyType,
          providerAmount: providerRecord.amount,
          localAmount: Number(localTxn.amount),
          description: `Amount mismatch: provider=${providerRecord.amount}, local=${localTxn.amount}`,
        });
        hasDiscrepancy = true;
      }

      if (localTxn.status !== providerRecord.status) {
        discrepancies.push({
          id: `disc_${discrepancyIdx++}`,
          transactionId: providerRecord.transactionId,
          type: 'STATUS_MISMATCH' as DiscrepancyType,
          providerStatus: providerRecord.status,
          localStatus: localTxn.status,
          description: `Status mismatch: provider=${providerRecord.status}, local=${localTxn.status}`,
        });
        hasDiscrepancy = true;
      }

      if (!hasDiscrepancy) {
        matched++;
      }
    }

    // Check local records not in provider settlement
    for (const localTxn of localTransactions) {
      if (!providerMap.has(localTxn.id)) {
        discrepancies.push({
          id: `disc_${discrepancyIdx++}`,
          transactionId: localTxn.id,
          type: 'MISSING_IN_PROVIDER' as DiscrepancyType,
          localAmount: Number(localTxn.amount),
          localStatus: localTxn.status,
          description: `Transaction ${localTxn.id} exists in local DB but not in provider settlement`,
        });
      }
    }

    const totalTransactions = new Set([
      ...request.settlementData.map((r) => r.transactionId),
      ...localTransactions.map((t) => t.id),
    ]).size;

    // Create report
    const report = await prisma.reconciliationReport.create({
      data: {
        merchantId: request.merchantId,
        status: discrepancies.length > 0 ? 'REQUIRES_REVIEW' : 'COMPLETED',
        periodStart: new Date(request.fromDate),
        periodEnd: new Date(request.toDate),
        totalTransactions,
        matchedTransactions: matched,
        unmatchedTransactions: discrepancies.length,
        discrepancies: discrepancies as object[],
        summary: {
          byType: this.countByType(discrepancies),
          reconciliationRate: totalTransactions > 0 ? Math.round((matched / totalTransactions) * 10000) / 100 : 100,
        },
        generatedAt: new Date(),
      },
    });

    logger.info('Reconciliation complete', {
      reportId: report.id,
      total: totalTransactions,
      matched,
      discrepancies: discrepancies.length,
    });

    return {
      id: report.id,
      merchantId: report.merchantId,
      status: report.status,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      totalTransactions: report.totalTransactions,
      matchedTransactions: report.matchedTransactions,
      unmatchedTransactions: report.unmatchedTransactions,
      discrepancyCount: discrepancies.length,
      discrepancies,
      summary: report.summary as Record<string, unknown>,
      createdAt: report.createdAt.toISOString(),
    };
  }

  async listReports(filter: {
    merchantId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    reports: ReconciliationReportSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filter.merchantId) where.merchantId = filter.merchantId;
    if (filter.status) where.status = filter.status;

    const [reports, total] = await Promise.all([
      prisma.reconciliationReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.reconciliationReport.count({ where }),
    ]);

    return {
      reports: reports.map((r) => ({
        id: r.id,
        merchantId: r.merchantId,
        status: r.status,
        periodStart: r.periodStart.toISOString(),
        periodEnd: r.periodEnd.toISOString(),
        totalTransactions: r.totalTransactions,
        matchedTransactions: r.matchedTransactions,
        unmatchedTransactions: r.unmatchedTransactions,
        discrepancyCount: (r.discrepancies as unknown[]).length,
        createdAt: r.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReport(reportId: string): Promise<ReconciliationReportDetail> {
    const report = await prisma.reconciliationReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw AppError.notFound(`Reconciliation report ${reportId} not found`);
    }

    return {
      id: report.id,
      merchantId: report.merchantId,
      status: report.status,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      totalTransactions: report.totalTransactions,
      matchedTransactions: report.matchedTransactions,
      unmatchedTransactions: report.unmatchedTransactions,
      discrepancyCount: (report.discrepancies as unknown[]).length,
      discrepancies: report.discrepancies as unknown as Discrepancy[],
      summary: report.summary as Record<string, unknown>,
      createdAt: report.createdAt.toISOString(),
    };
  }

  async resolveDiscrepancy(
    reportId: string,
    discrepancyId: string,
    resolution: DiscrepancyResolution,
    resolvedBy?: string
  ): Promise<ReconciliationReportDetail> {
    const report = await prisma.reconciliationReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw AppError.notFound(`Reconciliation report ${reportId} not found`);
    }

    const discrepancies = report.discrepancies as unknown as Discrepancy[];
    const discIdx = discrepancies.findIndex((d) => d.id === discrepancyId);

    if (discIdx === -1) {
      throw AppError.notFound(`Discrepancy ${discrepancyId} not found in report ${reportId}`);
    }

    const existing = discrepancies[discIdx]!;
    discrepancies[discIdx] = {
      ...existing,
      resolution,
      resolvedAt: new Date().toISOString(),
      resolvedBy,
    };

    const allResolved = discrepancies.every((d) => d.resolution);
    const newStatus = allResolved ? 'COMPLETED' : 'REQUIRES_REVIEW';

    const updated = await prisma.reconciliationReport.update({
      where: { id: reportId },
      data: {
        discrepancies: discrepancies as object[],
        status: newStatus,
        reviewedAt: allResolved ? new Date() : undefined,
        reviewedBy: allResolved ? resolvedBy : undefined,
      },
    });

    logger.info('Discrepancy resolved', {
      reportId,
      discrepancyId,
      resolution,
      allResolved,
    });

    return {
      id: updated.id,
      merchantId: updated.merchantId,
      status: updated.status,
      periodStart: updated.periodStart.toISOString(),
      periodEnd: updated.periodEnd.toISOString(),
      totalTransactions: updated.totalTransactions,
      matchedTransactions: updated.matchedTransactions,
      unmatchedTransactions: updated.unmatchedTransactions,
      discrepancyCount: discrepancies.length,
      discrepancies,
      summary: updated.summary as Record<string, unknown>,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  private addDiscrepancies(records: SettlementRecord[]): SettlementRecord[] {
    const modified = [...records];
    const discrepancyCount = Math.max(1, Math.floor(records.length * 0.12));

    const indices = new Set<number>();
    while (indices.size < discrepancyCount && indices.size < records.length) {
      indices.add(Math.floor(Math.random() * records.length));
    }

    let idx = 0;
    for (const i of indices) {
      const record = modified[i];
      if (!record) { idx++; continue; }
      const discType = idx % 3;
      if (discType === 0) {
        const factor = 1 + (Math.random() * 0.15 + 0.05) * (Math.random() > 0.5 ? 1 : -1);
        modified[i] = { ...record, amount: Math.round(record.amount * factor) };
      } else if (discType === 1) {
        modified[i] = { ...record, status: record.status === 'COMPLETED' ? 'FAILED' : 'COMPLETED' };
      } else {
        modified.splice(i, 1);
        modified.push({
          transactionId: crypto.randomUUID(),
          amount: Math.floor(Math.random() * 100000) + 1000,
          currency: 'USD',
          status: 'COMPLETED',
          settledAt: new Date().toISOString(),
        });
      }
      idx++;
    }

    return modified;
  }

  private toCsv(records: SettlementRecord[]): string {
    const headers = 'transactionId,amount,currency,status,providerRef,settledAt';
    const rows = records.map((r) =>
      `${r.transactionId},${r.amount},${r.currency},${r.status},${r.providerRef ?? ''},${r.settledAt ?? ''}`
    );
    return [headers, ...rows].join('\n');
  }

  private countByType(discrepancies: Discrepancy[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const d of discrepancies) {
      counts[d.type] = (counts[d.type] ?? 0) + 1;
    }
    return counts;
  }
}

export const reconciliationService = ReconciliationService.getInstance();
