import { BaseWebhookHandler } from './webhook.handler.js';
import { WebhookPayload } from '../provider.types.js';

interface PayPalEvent {
  id: string;
  event_type: string;
  resource: Record<string, unknown>;
  create_time: string;
}

export class PayPalWebhookHandler extends BaseWebhookHandler {
  protected providerCode = 'paypal';

  protected parseRawPayload(
    rawPayload: string,
    _headers: Record<string, string>
  ): WebhookPayload {
    const event: PayPalEvent = JSON.parse(rawPayload);

    return {
      eventType: event.event_type,
      providerEventId: event.id,
      providerTransactionId: event.resource.id as string | undefined,
      data: { resource: event.resource },
      timestamp: new Date(event.create_time),
    };
  }
}

export const paypalWebhookHandler = new PayPalWebhookHandler();
