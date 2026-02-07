import { Currency } from '@prisma/client';

export interface FxRate {
  id?: string;
  sourceCurrency: Currency;
  targetCurrency: Currency;
  rate: number;
  spread: number;
  effectiveRate: number;
  source: string;
  validFrom: Date;
  validTo?: Date;
}

export interface FxQuote {
  id: string;
  sourceCurrency: Currency;
  targetCurrency: Currency;
  sourceAmount: bigint;
  targetAmount: bigint;
  rate: number;
  spread: number;
  effectiveRate: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface ConversionResult {
  sourceAmount: bigint;
  sourceCurrency: Currency;
  targetAmount: bigint;
  targetCurrency: Currency;
  rate: number;
  effectiveRate: number;
  spread: number;
  fxRateId?: string;
}

export interface FxRateRequest {
  sourceCurrency: Currency;
  targetCurrency: Currency;
}

export interface FxConvertRequest {
  amount: bigint;
  sourceCurrency: Currency;
  targetCurrency: Currency;
}

export interface FxQuoteRequest {
  amount: bigint;
  sourceCurrency: Currency;
  targetCurrency: Currency;
  validityMinutes?: number;
}

export interface FxProviderRates {
  baseCurrency: Currency;
  rates: Record<Currency, number>;
  timestamp: Date;
  source: string;
}

export class FxError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'FxError';
    this.code = code;
  }

  static rateNotFound(source: Currency, target: Currency): FxError {
    return new FxError(
      `Exchange rate not found for ${source}/${target}`,
      'RATE_NOT_FOUND'
    );
  }

  static quoteExpired(): FxError {
    return new FxError('Quote has expired', 'QUOTE_EXPIRED');
  }

  static providerError(message: string): FxError {
    return new FxError(message, 'PROVIDER_ERROR');
  }
}
