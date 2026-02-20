import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentModule } from '../payment/payment.module';
import {
  CheckoutSession,
  CheckoutSessionSchema,
} from '../payment/providers/stripe/schemas/checkout-session.schema';
import {
  StripeCustomer,
  StripeCustomerSchema,
} from '../payment/providers/stripe/schemas/stripe-customer.schema';
import {
  Subscription,
  SubscriptionSchema,
} from '../payment/providers/stripe/schemas/subscription.schema';
import { WebhookEvent, WebhookEventSchema } from './schemas/webhook-event.schema';
import { WebhookHandlerService } from './services/webhook-handler.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [
    // Import PaymentModule to access StripeService
    PaymentModule,
    // Register schemas needed by WebhookHandlerService
    MongooseModule.forFeature([
      { name: WebhookEvent.name, schema: WebhookEventSchema },
      { name: StripeCustomer.name, schema: StripeCustomerSchema },
      { name: CheckoutSession.name, schema: CheckoutSessionSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  controllers: [WebhookController],
  providers: [WebhookHandlerService],
  exports: [WebhookHandlerService],
})
export class WebhookModule {}
