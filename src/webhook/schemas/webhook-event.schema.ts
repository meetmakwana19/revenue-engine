import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WebhookEventDocument = WebhookEvent & Document;

@Schema({ collection: 'webhook_events' })
export class WebhookEvent {
  @Prop({ required: true, unique: true })
  event_id: string; // Stripe event ID (evt_xxx)

  @Prop({ required: true })
  event_type: string; // e.g., 'checkout.session.completed'

  @Prop({ required: true })
  processed: boolean; // Whether this event has been processed

  @Prop({ type: Object })
  event_data?: Record<string, unknown>; // Store event payload for debugging

  @Prop({ type: Object })
  processing_result?: {
    success: boolean;
    error?: string;
    subscription_id?: string;
    organization_id?: string;
  };

  @Prop({ default: () => new Date() })
  created_at: Date;

  @Prop({ default: () => new Date() })
  updated_at: Date;

  @Prop()
  processed_at?: Date;
}

export const WebhookEventSchema = SchemaFactory.createForClass(WebhookEvent);

// Create index for faster lookups
WebhookEventSchema.index({ event_id: 1 }, { unique: true });
WebhookEventSchema.index({ processed: 1, created_at: -1 });
