import { apiClient } from './client';
import type { Currency } from '../types';

export interface FxRate {
  from: Currency;
  to: Currency;
  rate: number;
  timestamp: string;
}

export interface FxRatesResponse {
  success: boolean;
  data: {
    base: Currency;
    rates: Record<string, number>;
    timestamp: string;
  };
}

export const fxApi = {
  getAllRates: (base: Currency = 'USD') =>
    apiClient.get<FxRatesResponse>('/fx/rates/all', { params: { base } }),
};
