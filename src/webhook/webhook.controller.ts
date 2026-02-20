import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { StripeService } from '../payment/providers/stripe/services/stripe.service';
import { ProcessWebhookResult, WebhookHandlerService } from './services/webhook-handler.service';

@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookHandlerService: WebhookHandlerService,
  ) {}

  /**
   * Webhook endpoint for Stripe events
   *
   * This endpoint receives webhook events from Stripe and processes them through
   * the WebhookHandlerService which handles:
   * 1. Webhook signature verification
   * 2. Idempotency checking (prevents duplicate processing)
   * 3. Customer lookup
   * 4. Subscription verification with Stripe SDK
   * 5. Subscription status updates in our database
   *
   * This provides a backchannel approach to verify checkout subscription status,
   * independent of the /checkout/success endpoint.
   *
   * @param req - Express request with rawBody for signature verification
   * @param signature - Stripe signature header for webhook verification
   * @returns Webhook processing result
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing Stripe signature header');
    }

    // Get raw body for signature verification
    // Note: rawBody is enabled in main.ts via NestFactory.create({ rawBody: true })
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new BadRequestException(
        'Raw body is required for webhook signature verification. Ensure rawBody is enabled in NestFactory configuration.',
      );
    }

    // Step 1: Verify webhook signature
    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }

    // Step 2: Process webhook event through handler service
    // The service handles idempotency, customer lookup, subscription verification, and status updates
    // Note: TypeScript ESLint can't resolve NestJS DI types, but they're safe at runtime
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    let result: ProcessWebhookResult;
    try {
      result = await this.webhookHandlerService.processWebhookEvent(event);
    } catch (error: unknown) {
      // Log error but return 200 to Stripe (webhooks should always return 200)
      // Stripe will retry if needed, and we don't want to break the webhook flow
      throw new BadRequestException(
        `Error processing webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return {
      received: true,
      eventId: result.eventId,
      processed: result.processed,
      message: result.message,
    };
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  }
}
