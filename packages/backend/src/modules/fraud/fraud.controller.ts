import { Request, Response, NextFunction } from 'express';
import { fraudService } from './fraud.service.js';
import type {
  FraudCheckBody,
  FlaggedTransactionsQuery,
  FraudReviewBody,
  TransactionIdParam,
} from './fraud.schemas.js';

export class FraudController {
  async checkTransaction(
    req: Request<unknown, unknown, FraudCheckBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await fraudService.checkTransaction(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getFlaggedTransactions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const query = req.query as unknown as FlaggedTransactionsQuery;
      const result = await fraudService.getFlaggedTransactions({
        status: query.status,
        minRiskScore: query.minRiskScore,
        page: query.page,
        limit: query.limit,
      });
      res.json({
        success: true,
        data: result.transactions,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async reviewTransaction(
    req: Request<TransactionIdParam, unknown, FraudReviewBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { transactionId } = req.params;
      const { action, reason, reviewedBy } = req.body;
      const result = await fraudService.reviewTransaction(
        transactionId,
        action,
        reason,
        reviewedBy
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const fraudController = new FraudController();
