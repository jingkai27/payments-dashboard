import { Currency } from '@prisma/client';
import { prisma } from '../../shared/database/prisma.js';
import { cacheService } from '../../shared/cache/cache.service.js';
import { config } from '../../config/index.js';
import { logger } from '../../shared/utils/logger.js';
import {
  FxRate,
  FxQuote,
  ConversionResult,
  FxError,
  FxProviderRates,
} from './fx.types.js';
import {
  IFxRateProvider,
  exchangeRateApiProvider,
  fallbackProvider,
} from './providers/index.js';
import crypto from 'crypto';

const RATE_CACHE_PREFIX = 'fx:rate:';
const QUOTE_CACHE_PREFIX = 'fx:quote:';

export class FxService {
  private static instance: FxService | null = null;
  private providers: IFxRateProvider[];
  private readonly defaultSpread: number;
  private readonly cacheTtlSeconds: number;
  private readonly quoteValidityMinutes: number;

  private constructor() {
    // Providers in priority order
    this.providers = [exchangeRateApiProvider, fallbackProvider];
    this.defaultSpread = config.env.FX_DEFAULT_SPREAD ?? 0.005;
    this.cacheTtlSeconds = config.env.FX_CACHE_TTL_SECONDS ?? 3600;
    this.quoteValidityMinutes = config.env.FX_RATE_VALIDITY_MINUTES ?? 15;
  }

  static getInstance(): FxService {
    if (!FxService.instance) {
      FxService.instance = new FxService();
    }
    return FxService.instance;
  }

  async getRate(source: Currency, target: Currency): Promise<FxRate> {
    // Same currency - no conversion needed
    if (source === target) {
      return {
        sourceCurrency: source,
        targetCurrency: target,
        rate: 1,
        spread: 0,
        effectiveRate: 1,
        source: 'identity',
        validFrom: new Date(),
      };
    }

    // Check cache first
    const cacheKey = `${RATE_CACHE_PREFIX}${source}:${target}`;
    const cached = await cacheService.get<FxRate>(cacheKey);

    if (cached) {
      return cached;
    }

    // Check database for recent rate
    const dbRate = await this.getLatestRateFromDb(source, target);
    if (dbRate) {
      await cacheService.setWithTTL(cacheKey, dbRate, this.cacheTtlSeconds);
      return dbRate;
    }

    // Fetch from providers
    const rate = await this.fetchRateFromProviders(source, target);

    // Store in database
    await this.storeRate(rate);

    // Cache the rate
    await cacheService.setWithTTL(cacheKey, rate, this.cacheTtlSeconds);

    return rate;
  }

  async getAllRates(baseCurrency: Currency): Promise<FxRate[]> {
    const currencies: Currency[] = [
      'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
    ];

    const rates: FxRate[] = [];

    for (const target of currencies) {
      if (target !== baseCurrency) {
        const rate = await this.getRate(baseCurrency, target);
        rates.push(rate);
      }
    }

    return rates;
  }

  async convert(
    amount: bigint,
    source: Currency,
    target: Currency
  ): Promise<ConversionResult> {
    const rate = await this.getRate(source, target);

    // Apply spread to get effective rate
    const effectiveRate = rate.rate * (1 + rate.spread);

    // Calculate target amount
    // Amount is in smallest unit (cents), so we multiply and round
    const targetAmount = BigInt(Math.round(Number(amount) * effectiveRate));

    return {
      sourceAmount: amount,
      sourceCurrency: source,
      targetAmount,
      targetCurrency: target,
      rate: rate.rate,
      effectiveRate,
      spread: rate.spread,
      fxRateId: rate.id,
    };
  }

  async getQuote(
    amount: bigint,
    source: Currency,
    target: Currency,
    validityMinutes?: number
  ): Promise<FxQuote> {
    const validity = validityMinutes ?? this.quoteValidityMinutes;
    const conversion = await this.convert(amount, source, target);

    const quoteId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + validity * 60 * 1000);

    const quote: FxQuote = {
      id: quoteId,
      sourceCurrency: source,
      targetCurrency: target,
      sourceAmount: amount,
      targetAmount: conversion.targetAmount,
      rate: conversion.rate,
      spread: conversion.spread,
      effectiveRate: conversion.effectiveRate,
      expiresAt,
      createdAt: new Date(),
    };

    // Cache the quote
    const cacheKey = `${QUOTE_CACHE_PREFIX}${quoteId}`;
    await cacheService.setWithTTL(cacheKey, quote, validity * 60);

    logger.debug('Created FX quote', {
      quoteId,
      source,
      target,
      amount: amount.toString(),
      expiresAt,
    });

    return quote;
  }

  async validateQuote(quoteId: string): Promise<FxQuote> {
    const cacheKey = `${QUOTE_CACHE_PREFIX}${quoteId}`;
    const quote = await cacheService.get<FxQuote>(cacheKey);

    if (!quote) {
      throw FxError.quoteExpired();
    }

    if (new Date(quote.expiresAt) < new Date()) {
      await cacheService.delete(cacheKey);
      throw FxError.quoteExpired();
    }

    return quote;
  }

  async refreshRates(baseCurrency: Currency = 'USD'): Promise<FxProviderRates> {
    logger.info('Refreshing FX rates', { baseCurrency });

    // Clear cached rates
    await cacheService.deletePattern(`${RATE_CACHE_PREFIX}*`);

    // Fetch fresh rates
    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        if (!available) continue;

        const rates = await provider.fetchRates(baseCurrency);

        // Store all rates
        const currencies = Object.keys(rates.rates) as Currency[];
        for (const target of currencies) {
          if (target !== baseCurrency) {
            const rate: FxRate = {
              sourceCurrency: baseCurrency,
              targetCurrency: target,
              rate: rates.rates[target],
              spread: this.defaultSpread,
              effectiveRate: rates.rates[target] * (1 + this.defaultSpread),
              source: provider.name,
              validFrom: rates.timestamp,
            };
            await this.storeRate(rate);
          }
        }

        logger.info('Refreshed FX rates successfully', {
          provider: provider.name,
          rateCount: currencies.length,
        });

        return rates;
      } catch (error) {
        logger.warn('Provider failed to refresh rates', {
          provider: provider.name,
          error: (error as Error).message,
        });
        continue;
      }
    }

    throw FxError.providerError('All FX providers failed');
  }

  private async getLatestRateFromDb(
    source: Currency,
    target: Currency
  ): Promise<FxRate | null> {
    const rate = await prisma.fxRate.findFirst({
      where: {
        sourceCurrency: source,
        targetCurrency: target,
        isActive: true,
        validFrom: { lte: new Date() },
        OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
      },
      orderBy: { validFrom: 'desc' },
    });

    if (!rate) {
      return null;
    }

    return {
      id: rate.id,
      sourceCurrency: rate.sourceCurrency,
      targetCurrency: rate.targetCurrency,
      rate: Number(rate.rate),
      spread: Number(rate.spread),
      effectiveRate: Number(rate.effectiveRate),
      source: rate.source,
      validFrom: rate.validFrom,
      validTo: rate.validTo ?? undefined,
    };
  }

  private async fetchRateFromProviders(
    source: Currency,
    target: Currency
  ): Promise<FxRate> {
    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        if (!available) continue;

        const rate = await provider.getRate(source, target);

        if (rate !== null) {
          return {
            sourceCurrency: source,
            targetCurrency: target,
            rate,
            spread: this.defaultSpread,
            effectiveRate: rate * (1 + this.defaultSpread),
            source: provider.name,
            validFrom: new Date(),
          };
        }
      } catch (error) {
        logger.warn('Provider failed to fetch rate', {
          provider: provider.name,
          source,
          target,
          error: (error as Error).message,
        });
        continue;
      }
    }

    throw FxError.rateNotFound(source, target);
  }

  private async storeRate(rate: FxRate): Promise<void> {
    try {
      await prisma.fxRate.create({
        data: {
          sourceCurrency: rate.sourceCurrency,
          targetCurrency: rate.targetCurrency,
          rate: rate.rate,
          spread: rate.spread,
          effectiveRate: rate.effectiveRate,
          source: rate.source,
          validFrom: rate.validFrom,
          validTo: rate.validTo,
          isActive: true,
        },
      });
    } catch (error) {
      // Ignore duplicate key errors
      if ((error as Error).message.includes('Unique constraint')) {
        return;
      }
      logger.error('Failed to store FX rate', { error: (error as Error).message });
    }
  }
}

export const fxService = FxService.getInstance();
