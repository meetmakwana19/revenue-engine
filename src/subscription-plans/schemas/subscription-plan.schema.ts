import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type SubscriptionPlanDocument = HydratedDocument<SubscriptionPlan>;

export class Price {
  id: string;
  interval: string; // e.g., 'month', 'year'
}

const PriceSchema = new MongooseSchema(
  {
    id: { type: String, required: true },
    interval: { type: String, required: true },
  },
  { _id: false },
);

@Schema({ collection: 'subscription_plans' })
export class SubscriptionPlan {
  @Prop({ required: true, unique: true })
  subscription_plan_uid: string;

  @Prop({ required: true })
  name: string;

  @Prop({
    type: {
      product_uid: { type: String, required: true },
    },
    required: true,
  })
  metadata: {
    product_uid: string;
  };

  @Prop({ type: [PriceSchema], default: [] })
  prices: Price[];

  @Prop({ default: () => new Date() })
  created_at: Date;

  @Prop({ default: () => new Date() })
  updated_at: Date;
}

export const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);
