import { Request, Response, NextFunction } from 'express';
import { fxService } from './fx.service.js';
import { GetRateQuery, GetAllRatesQuery, ConvertBody, QuoteBody, RefreshRatesBody } from './fx.schemas.js';
import { Currency } from '@prisma/client';

export class FxController {
  async getRate(
    req: Request<unknown, unknown, unknown, GetRateQuery>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { source, target } = req.query;

      const rate = await fxService.getRate(source as Currency, target as Currency);

      res.json({
        success: true,
        data: {
          sourceCurrency: rate.sourceCurrency,
          targetCurrency: rate.targetCurrency,
          rate: rate.rate,
          spread: rate.spread,
          effectiveRate: rate.effectiveRate,
          source: rate.source,
          validFrom: rate.validFrom.toISOString(),
          validTo: rate.validTo?.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllRates(
    req: Request<unknown, unknown, unknown, GetAllRatesQuery>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { base } = req.query;

      const rates = await fxService.getAllRates(base as Currency);

      res.json({
        success: true,
        data: {
          baseCurrency: base,
          rates: rates.map((r) => ({
            targetCurrency: r.targetCurrency,
            rate: r.rate,
            effectiveRate: r.effectiveRate,
            spread: r.spread,
          })),
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async convert(
    req: Request<unknown, unknown, ConvertBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { amount, sourceCurrency, targetCurrency } = req.body;

      const result = await fxService.convert(
        amount,
        sourceCurrency as Currency,
        targetCurrency as Currency
      );

      res.json({
        success: true,
        data: {
          sourceAmount: result.sourceAmount.toString(),
          sourceCurrency: result.sourceCurrency,
          targetAmount: result.targetAmount.toString(),
          targetCurrency: result.targetCurrency,
          rate: result.rate,
          effectiveRate: result.effectiveRate,
          spread: result.spread,
          fxRateId: result.fxRateId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getQuote(
    req: Request<unknown, unknown, QuoteBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { amount, sourceCurrency, targetCurrency, validityMinutes } = req.body;

      const quote = await fxService.getQuote(
        amount,
        sourceCurrency as Currency,
        targetCurrency as Currency,
        validityMinutes
      );

      res.json({
        success: true,
        data: {
          id: quote.id,
          sourceCurrency: quote.sourceCurrency,
          targetCurrency: quote.targetCurrency,
          sourceAmount: quote.sourceAmount.toString(),
          targetAmount: quote.targetAmount.toString(),
          rate: quote.rate,
          effectiveRate: quote.effectiveRate,
          spread: quote.spread,
          expiresAt: quote.expiresAt.toISOString(),
          createdAt: quote.createdAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshRates(
    req: Request<unknown, unknown, RefreshRatesBody>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const baseCurrency = (req.body?.baseCurrency ?? 'USD') as Currency;

      const rates = await fxService.refreshRates(baseCurrency);

      res.json({
        success: true,
        data: {
          baseCurrency: rates.baseCurrency,
          rateCount: Object.keys(rates.rates).length,
          source: rates.source,
          timestamp: rates.timestamp.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const fxController = new FxController();
