import { Currency } from '@prisma/client';
import { IFxRateProvider } from './fx-provider.interface.js';
import { FxProviderRates, FxError } from '../fx.types.js';
import { config } from '../../../config/index.js';
import { logger } from '../../../shared/utils/logger.js';

interface ExchangeRateApiResponse {
  result: 'success' | 'error';
  time_last_update_unix?: number;
  base_code?: string;
  conversion_rates?: Record<string, number>;
  'error-type'?: string;
}

export class ExchangeRateApiProvider implements IFxRateProvider {
  readonly name = 'exchangerate-api';
  readonly priority = 1;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = config.env.FX_PROVIDER_BASE_URL ?? 'https://v6.exchangerate-api.com/v6';
    this.apiKey = config.env.FX_PROVIDER_API_KEY ?? '';
  }

  async fetchRates(baseCurrency: Currency): Promise<FxProviderRates> {
    if (!this.apiKey) {
      throw FxError.providerError('FX provider API key not configured');
    }

    const url = `${this.baseUrl}/${this.apiKey}/latest/${baseCurrency}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw FxError.providerError(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as ExchangeRateApiResponse;

      if (data.result !== 'success') {
        throw FxError.providerError(data['error-type'] || 'Unknown error');
      }

      const rates: Record<Currency, number> = {} as Record<Currency, number>;
      const supportedCurrencies: Currency[] = [
        'USD', 'EUR', 'GBP', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD',
      ];

      for (const currency of supportedCurrencies) {
        if (data.conversion_rates?.[currency]) {
          rates[currency] = data.conversion_rates[currency];
        }
      }

      logger.debug('Fetched exchange rates from API', {
        baseCurrency,
        rateCount: Object.keys(rates).length,
      });

      return {
        baseCurrency,
        rates,
        timestamp: new Date(data.time_last_update_unix! * 1000),
        source: this.name,
      };
    } catch (error) {
      if (error instanceof FxError) {
        throw error;
      }
      logger.error('Failed to fetch exchange rates', { error: (error as Error).message });
      throw FxError.providerError((error as Error).message);
    }
  }

  async getRate(source: Currency, target: Currency): Promise<number | null> {
    try {
      const rates = await this.fetchRates(source);
      return rates.rates[target] ?? null;
    } catch {
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/${this.apiKey}/latest/USD`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const exchangeRateApiProvider = new ExchangeRateApiProvider();
