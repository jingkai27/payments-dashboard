import { BaseWebhookHandler } from './webhook.handler.js';
import { WebhookPayload } from '../provider.types.js';

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
}

export class StripeWebhookHandler extends BaseWebhookHandler {
  protected providerCode = 'stripe';

  protected parseRawPayload(
    rawPayload: string,
    _headers: Record<string, string>
  ): WebhookPayload {
    const event: StripeEvent = JSON.parse(rawPayload);

    return {
      eventType: event.type,
      providerEventId: event.id,
      providerTransactionId: event.data.object.id as string | undefined,
      data: event.data.object,
      timestamp: new Date(event.created * 1000),
    };
  }
}

export const stripeWebhookHandler = new StripeWebhookHandler();
