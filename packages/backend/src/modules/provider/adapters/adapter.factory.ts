import { IPaymentProviderAdapter } from './base.adapter.js';
import { StripeAdapter } from './stripe.adapter.js';
import { PayPalAdapter } from './paypal.adapter.js';
import { ProviderConfig, ProviderError } from '../provider.types.js';
import { logger } from '../../../shared/utils/logger.js';

type AdapterConstructor = new () => IPaymentProviderAdapter;

const adapterRegistry = new Map<string, AdapterConstructor>([
  ['stripe', StripeAdapter as AdapterConstructor],
  ['paypal', PayPalAdapter as AdapterConstructor],
]);

const adapterInstances: Map<string, IPaymentProviderAdapter> = new Map();

export class AdapterFactory {
  static registerAdapter(providerCode: string, adapter: AdapterConstructor): void {
    adapterRegistry.set(providerCode.toLowerCase(), adapter);
    logger.info('Registered payment provider adapter', { providerCode });
  }

  static async getAdapter(
    providerCode: string,
    config?: ProviderConfig
  ): Promise<IPaymentProviderAdapter> {
    const code = providerCode.toLowerCase();

    // Return cached instance if exists
    if (adapterInstances.has(code)) {
      return adapterInstances.get(code)!;
    }

    const AdapterClass = adapterRegistry.get(code);

    if (!AdapterClass) {
      throw new ProviderError(
        `No adapter registered for provider: ${providerCode}`,
        'PROVIDER_UNAVAILABLE'
      );
    }

    const adapter = new AdapterClass();

    if (config) {
      await adapter.initialize(config);
    }

    adapterInstances.set(code, adapter);
    logger.info('Created payment provider adapter instance', { providerCode: code });

    return adapter;
  }

  static getAvailableProviders(): string[] {
    return Array.from(adapterRegistry.keys());
  }

  static hasAdapter(providerCode: string): boolean {
    return adapterRegistry.has(providerCode.toLowerCase());
  }

  static clearInstances(): void {
    adapterInstances.clear();
    logger.debug('Cleared all adapter instances');
  }

  static removeInstance(providerCode: string): void {
    adapterInstances.delete(providerCode.toLowerCase());
  }
}
