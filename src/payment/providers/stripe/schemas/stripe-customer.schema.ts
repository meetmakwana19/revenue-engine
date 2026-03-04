import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StripeCustomerDocument = HydratedDocument<StripeCustomer>;

@Schema({ collection: 'stripe_customers' })
export class StripeCustomer {
  @Prop({ required: true, unique: true })
  organization_id: string;

  @Prop({ required: true, unique: true })
  stripe_customer_id: string;

  @Prop()
  email?: string;

  @Prop()
  name?: string;

  @Prop({ type: Object })
  stripe_data?: Record<string, unknown>;

  @Prop({ default: () => new Date() })
  created_at: Date;

  @Prop({ default: () => new Date() })
  updated_at: Date;
}

export const StripeCustomerSchema = SchemaFactory.createForClass(StripeCustomer);
