import { Request, Response, NextFunction } from 'express';
import { reconciliationService } from './reconciliation.service.js';
import type {
  MockSettlementQuery,
  ReconcileBody,
  ListReportsQuery,
  ReportIdParam,
  ResolveDiscrepancyBody,
} from './reconciliation.schemas.js';

export class ReconciliationController {
  async generateMockSettlement(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as MockSettlementQuery;
      const result = await reconciliationService.generateMockSettlement({
        merchantId: query.merchantId,
        providerId: query.providerId,
        fromDate: query.fromDate,
        toDate: query.toDate,
        format: query.format,
        introduceDiscrepancies: query.introduceDiscrepancies,
      });

      if (query.format === 'csv' && result.csv) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=settlement.csv');
        res.send(result.csv);
        return;
      }

      res.json({ success: true, data: result.records });
    } catch (error) {
      next(error);
    }
  }

  async reconcile(
    req: Request<unknown, unknown, ReconcileBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const report = await reconciliationService.reconcile(req.body);
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async listReports(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as ListReportsQuery;
      const result = await reconciliationService.listReports({
        merchantId: query.merchantId,
        status: query.status,
        page: query.page,
        limit: query.limit,
      });
      res.json({
        success: true,
        data: result.reports,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getReport(
    req: Request<ReportIdParam>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { reportId } = req.params;
      const report = await reconciliationService.getReport(reportId);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  async resolveDiscrepancy(
    req: Request<ReportIdParam, unknown, ResolveDiscrepancyBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { reportId } = req.params;
      const { discrepancyId, resolution, resolvedBy } = req.body;
      const report = await reconciliationService.resolveDiscrepancy(
        reportId,
        discrepancyId,
        resolution,
        resolvedBy
      );
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
}

export const reconciliationController = new ReconciliationController();
