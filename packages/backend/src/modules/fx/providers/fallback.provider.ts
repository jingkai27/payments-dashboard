import { Currency } from '@prisma/client';
import { IFxRateProvider } from './fx-provider.interface.js';
import { FxProviderRates } from '../fx.types.js';
import { logger } from '../../../shared/utils/logger.js';

// Static fallback rates (USD as base)
// These rates are approximate and should only be used as fallback
const FALLBACK_RATES_USD: Record<Currency, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  SGD: 1.34,
  JPY: 149.5,
  AUD: 1.53,
  CAD: 1.36,
  CHF: 0.88,
  CNY: 7.24,
  HKD: 7.82,
};

export class FallbackProvider implements IFxRateProvider {
  readonly name = 'fallback';
  readonly priority = 999; // Lowest priority

  async fetchRates(baseCurrency: Currency): Promise<FxProviderRates> {
    logger.warn('Using fallback FX rates', { baseCurrency });

    // Convert all rates to requested base currency
    const baseRateUSD = FALLBACK_RATES_USD[baseCurrency];
    const rates: Record<Currency, number> = {} as Record<Currency, number>;

    for (const [currency, usdRate] of Object.entries(FALLBACK_RATES_USD)) {
      // Calculate cross rate: target/base = (target/USD) / (base/USD)
      rates[currency as Currency] = usdRate / baseRateUSD;
    }

    return {
      baseCurrency,
      rates,
      timestamp: new Date(),
      source: this.name,
    };
  }

  async getRate(source: Currency, target: Currency): Promise<number | null> {
    const sourceRateUSD = FALLBACK_RATES_USD[source];
    const targetRateUSD = FALLBACK_RATES_USD[target];

    if (!sourceRateUSD || !targetRateUSD) {
      return null;
    }

    // Cross rate calculation
    return targetRateUSD / sourceRateUSD;
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available as fallback
  }
}

export const fallbackProvider = new FallbackProvider();
