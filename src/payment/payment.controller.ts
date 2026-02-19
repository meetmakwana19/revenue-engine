import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import type { SubscriptionPlan } from '../subscription-plans/schemas/subscription-plan.schema';
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service';
import { CheckoutHeaders } from './decorators/checkout-headers.decorator';
import type { ICheckoutHeaders } from './dto/checkout-headers.dto';
import { CreateCheckoutSessionDto } from './providers/stripe/dto/create-checkout-session.dto';
import { CreateCheckoutDto } from './providers/stripe/dto/create-checkout.dto';
import { CreateCustomerDto } from './providers/stripe/dto/create-customer.dto';
import { CreatePaymentIntentDto } from './providers/stripe/dto/create-payment-intent.dto';
import { CreatePriceDto } from './providers/stripe/dto/create-price.dto';
import { CreateProductDto } from './providers/stripe/dto/create-product.dto';
import { CreateSubscriptionDto } from './providers/stripe/dto/create-subscription.dto';
import { VerifyCheckoutSessionDto } from './providers/stripe/dto/verify-checkout-session.dto';
import { PriceValidationResult, StripeService } from './providers/stripe/services/stripe.service';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  // Customer endpoints
  @Post('customers')
  @HttpCode(HttpStatus.CREATED)
  async createCustomer(@Body() createCustomerDto: CreateCustomerDto) {
    return await this.stripeService.createCustomer(createCustomerDto.email, createCustomerDto.name);
  }

  @Get('customers')
  async listCustomers(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return await this.stripeService.listCustomers(limitNum);
  }

  @Get('customers/:id')
  async getCustomer(@Param('id') id: string) {
    return await this.stripeService.getCustomer(id);
  }

  @Put('customers/:id')
  async updateCustomer(
    @Param('id') id: string,
    @Body()
    data: { email?: string; name?: string; metadata?: Record<string, string> },
  ) {
    return await this.stripeService.updateCustomer(id, data);
  }

  @Delete('customers/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCustomer(@Param('id') id: string) {
    return await this.stripeService.deleteCustomer(id);
  }

  // Payment Intent endpoints
  @Post('payment-intents')
  @HttpCode(HttpStatus.CREATED)
  async createPaymentIntent(@Body() createPaymentIntentDto: CreatePaymentIntentDto) {
    // Use enhanced method if priceId or productId is provided
    if (createPaymentIntentDto.priceId || createPaymentIntentDto.productId) {
      return await this.stripeService.createPaymentIntentWithProduct({
        priceId: createPaymentIntentDto.priceId,
        productId: createPaymentIntentDto.productId,
        amount: createPaymentIntentDto.amount,
        currency: createPaymentIntentDto.currency,
        customerId: createPaymentIntentDto.customerId,
        customerEmail: createPaymentIntentDto.customerEmail,
        metadata: createPaymentIntentDto.metadata,
        paymentMethodTypes: createPaymentIntentDto.paymentMethodTypes,
        automaticPaymentMethods: createPaymentIntentDto.automaticPaymentMethods,
      });
    }

    // Fallback to original method for direct amount
    if (!createPaymentIntentDto.amount) {
      throw new Error('Either amount or priceId must be provided');
    }

    return await this.stripeService.createPaymentIntent(
      createPaymentIntentDto.amount,
      createPaymentIntentDto.currency,
      createPaymentIntentDto.customerId,
      createPaymentIntentDto.metadata,
    );
  }

  @Get('payment-intents/:id')
  async getPaymentIntent(@Param('id') id: string) {
    return await this.stripeService.getPaymentIntent(id);
  }

  @Post('payment-intents/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPaymentIntent(@Param('id') id: string) {
    return await this.stripeService.confirmPaymentIntent(id);
  }

  @Post('payment-intents/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPaymentIntent(@Param('id') id: string) {
    return await this.stripeService.cancelPaymentIntent(id);
  }

  // Product endpoints
  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  async createProduct(@Body() createProductDto: CreateProductDto) {
    return await this.stripeService.createProduct(
      createProductDto.name,
      createProductDto.description,
      createProductDto.images,
    );
  }

  @Get('products')
  async listProducts(@Query('limit') limit?: string, @Query('active') active?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const activeBool = active === undefined ? true : active.toLowerCase() === 'true';
    return await this.stripeService.listProducts(limitNum, activeBool);
  }

  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    return await this.stripeService.getProduct(id);
  }

  @Put('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string; images?: string[] },
  ) {
    return await this.stripeService.updateProduct(id, data);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.OK)
  async deleteProduct(@Param('id') id: string) {
    return await this.stripeService.deleteProduct(id);
  }

  // Price endpoints
  @Post('prices')
  @HttpCode(HttpStatus.CREATED)
  async createPrice(@Body() createPriceDto: CreatePriceDto) {
    return await this.stripeService.createPrice(
      createPriceDto.productId,
      createPriceDto.unitAmount,
      createPriceDto.currency,
      createPriceDto.recurring,
    );
  }

  @Get('prices')
  async listPrices(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return await this.stripeService.listPrices(limitNum);
  }

  @Get('prices/:id')
  async getPrice(@Param('id') id: string) {
    return await this.stripeService.getPrice(id);
  }

  // Subscription endpoints
  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return await this.stripeService.createSubscription(
      createSubscriptionDto.customerId,
      createSubscriptionDto.items,
      createSubscriptionDto.metadata,
    );
  }

  @Get('subscriptions')
  async listSubscriptions(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return await this.stripeService.listSubscriptions(limitNum);
  }

  @Get('subscriptions/:id')
  async getSubscription(@Param('id') id: string) {
    return await this.stripeService.getSubscription(id);
  }

  @Post('subscriptions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@Param('id') id: string) {
    return await this.stripeService.cancelSubscription(id);
  }

  // Checkout Session endpoints (Recommended for custom payment flow)
  @Post('checkout-sessions')
  @HttpCode(HttpStatus.CREATED)
  async createCheckoutSession(@Body() createCheckoutSessionDto: CreateCheckoutSessionDto) {
    return await this.stripeService.createCheckoutSession({
      priceId: createCheckoutSessionDto.priceId,
      productId: createCheckoutSessionDto.productId,
      amount: createCheckoutSessionDto.amount,
      currency: createCheckoutSessionDto.currency,
      customerId: createCheckoutSessionDto.customerId,
      customerEmail: createCheckoutSessionDto.customerEmail,
      successUrl: createCheckoutSessionDto.successUrl,
      cancelUrl: createCheckoutSessionDto.cancelUrl,
      metadata: createCheckoutSessionDto.metadata,
      mode: createCheckoutSessionDto.mode,
    });
  }

  @Get('checkout-sessions/:id')
  async getCheckoutSession(@Param('id') id: string) {
    return await this.stripeService.getCheckoutSession(id);
  }

  // New checkout endpoint matching your API structure
  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  async createCheckout(
    @CheckoutHeaders() headers: ICheckoutHeaders,
    @Body() createCheckoutDto: CreateCheckoutDto,
  ) {
    // Headers are automatically validated by @CheckoutHeaders() decorator
    // organizationId and customerEmail are now extracted from headers
    // subscription_plan_uid is in the request body

    // Query subscription plan to get priceId from prices array based on billing_interval
    let subscriptionPlan: SubscriptionPlan;
    try {
      const plan = await this.subscriptionPlansService.findOne(
        createCheckoutDto.subscription_plan_uid,
      );
      if (!plan) {
        throw new BadRequestException(
          `Subscription plan with UID '${createCheckoutDto.subscription_plan_uid}' not found`,
        );
      }
      subscriptionPlan = plan;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Subscription plan with UID '${createCheckoutDto.subscription_plan_uid}' not found`,
      );
    }

    // Find the price matching the billing_interval
    const price = subscriptionPlan.prices?.find(
      (p) => p.interval === createCheckoutDto.billing_interval,
    );

    if (!price || !price.id) {
      throw new BadRequestException(
        `No price found for subscription plan '${createCheckoutDto.subscription_plan_uid}' with billing interval '${createCheckoutDto.billing_interval}'`,
      );
    }

    const priceId = price.id;

    // Validate priceId before proceeding
    try {
      const validation: PriceValidationResult = await this.stripeService.validatePriceId(
        priceId,
        createCheckoutDto.billing_interval,
      );

      if (!validation.valid) {
        const errorMessage = validation.error ?? 'Invalid price ID';
        throw new BadRequestException(errorMessage);
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to validate price ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    const baseUrl = 'https://localhost:8082/#!/user';

    const result = await this.stripeService.createCheckoutSessionWithPersistence({
      organizationId: headers.organizationId,
      planId: createCheckoutDto.subscription_plan_uid,
      billingInterval: createCheckoutDto.billing_interval,
      priceId,
      customerEmail: headers.customerEmail,
      successUrl: `${baseUrl}/checkout-success?session_id={CHECKOUT_SESSION_ID}`, // Stripe replaces {CHECKOUT_SESSION_ID} with the actual session ID when redirecting.
      cancelUrl: `${baseUrl}/checkout-cancel`, // Todo on frontend, we need to handle this.
      overagesEnabled: createCheckoutDto.overages_enabled,
      overageBandwidth: createCheckoutDto.overage_bandwidth,
      overageApi: createCheckoutDto.overage_api,
    });

    return {
      checkout_url: result.checkout_url,
    };
  }

  // Success endpoint
  @Post('checkout/success')
  @HttpCode(HttpStatus.OK)
  async checkoutSuccess(@Body() verifyCheckoutSessionDto: VerifyCheckoutSessionDto) {
    return await this.stripeService.verifyCheckoutSession(verifyCheckoutSessionDto.session_id);
  }

  // Webhook endpoint for Stripe events
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

    let event: Stripe.Event;

    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new Error(
        `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        // Handle successful payment
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        // Add your business logic here (e.g., update database, send confirmation email)
        break;
      }

      case 'payment_intent.payment_failed': {
        // Handle failed payment
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id);
        // Add your business logic here
        break;
      }

      case 'checkout.session.completed': {
        // Handle completed checkout session
        const session = event.data.object;
        console.log('Checkout completed:', session.id);

        // Verify and process the checkout session
        // This ensures the subscription is created and linked properly
        try {
          await this.stripeService.verifyCheckoutSession(session.id);
          // Add additional business logic here (e.g., send confirmation email, update user status)
        } catch (error) {
          console.error('Error processing checkout session:', error);
          // Don't throw - webhook should return 200 even if processing fails
          // You can implement retry logic or alerting here
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  // Health check endpoint
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      message: 'Stripe service is running',
      timestamp: new Date().toISOString(),
    };
  }
}
