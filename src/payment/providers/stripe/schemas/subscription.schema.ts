import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

@Schema({ collection: 'subscriptions' })
export class Subscription {
  @Prop({ required: true, unique: true })
  stripe_subscription_id: string; // Stripe subscription ID (sub_xxx)

  @Prop({ required: true })
  organization_id: string;

  @Prop({ required: true })
  stripe_customer_id: string;

  @Prop()
  plan_id?: string;

  @Prop()
  billing_interval?: string; // 'month' | 'year'

  @Prop({ required: true })
  status: string; // active, canceled, past_due, unpaid, trialing, etc.

  @Prop({ required: true })
  current_period_start: Date;

  @Prop({ required: true })
  current_period_end: Date;

  @Prop({ default: false })
  cancel_at_period_end: boolean;

  @Prop()
  canceled_at?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, string>;

  @Prop({ type: Object })
  stripe_data?: Record<string, unknown>; // Full Stripe subscription object

  @Prop({ default: () => new Date() })
  created_at: Date;

  @Prop({ default: () => new Date() })
  updated_at: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

// Create indexes for faster lookups
SubscriptionSchema.index({ stripe_subscription_id: 1 }, { unique: true });
SubscriptionSchema.index({ organization_id: 1 });
SubscriptionSchema.index({ stripe_customer_id: 1 });
SubscriptionSchema.index({ status: 1 });
