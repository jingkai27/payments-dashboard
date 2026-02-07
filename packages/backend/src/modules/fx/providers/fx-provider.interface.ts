import { Currency } from '@prisma/client';
import { FxProviderRates } from '../fx.types.js';

export interface IFxRateProvider {
  readonly name: string;
  readonly priority: number;

  fetchRates(baseCurrency: Currency): Promise<FxProviderRates>;
  getRate(source: Currency, target: Currency): Promise<number | null>;
  isAvailable(): Promise<boolean>;
}
