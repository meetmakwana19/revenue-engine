import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentController } from './payment.controller';
import {
  CheckoutSession,
  CheckoutSessionSchema,
} from './providers/stripe/schemas/checkout-session.schema';
import {
  StripeCustomer,
  StripeCustomerSchema,
} from './providers/stripe/schemas/stripe-customer.schema';
import { StripeService } from './providers/stripe/services/stripe.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StripeCustomer.name, schema: StripeCustomerSchema },
      { name: CheckoutSession.name, schema: CheckoutSessionSchema },
    ]),
  ],
  controllers: [PaymentController],
  providers: [StripeService],
  exports: [StripeService],
})
export class PaymentModule {}
