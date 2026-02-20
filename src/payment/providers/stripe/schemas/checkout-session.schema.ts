import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CheckoutSessionDocument = CheckoutSession & Document;

@Schema({ collection: 'checkout_sessions' })
export class CheckoutSession {
  @Prop({ required: true })
  organization_id: string;

  @Prop({ required: true, unique: true })
  stripe_session_id: string;

  @Prop({ required: true })
  stripe_customer_id: string;

  @Prop()
  plan_id?: string;

  @Prop()
  billing_interval?: string;

  @Prop({ type: Object })
  metadata?: Record<string, string>;

  @Prop({ default: 'pending' })
  status: string; // pending, completed, expired

  @Prop({ default: () => new Date() })
  created_at: Date;

  @Prop({ default: () => new Date() })
  updated_at: Date;
}

export const CheckoutSessionSchema = SchemaFactory.createForClass(CheckoutSession);
