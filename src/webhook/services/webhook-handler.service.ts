import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import {
  CheckoutSession,
  CheckoutSessionDocument,
} from '../../payment/providers/stripe/schemas/checkout-session.schema';
import {
  StripeCustomer,
  StripeCustomerDocument,
} from '../../payment/providers/stripe/schemas/stripe-customer.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../../payment/providers/stripe/schemas/subscription.schema';
import { StripeService } from '../../payment/providers/stripe/services/stripe.service';
import { WebhookEvent, WebhookEventDocument } from '../schemas/webhook-event.schema';

export interface ProcessWebhookResult {
  success: boolean;
  eventId: string;
  processed: boolean;
  message: string;
  subscriptionId?: string;
  organizationId?: string;
}

@Injectable()
export class WebhookHandlerService {
  private readonly logger = new Logger(WebhookHandlerService.name);

  constructor(
    @InjectModel(WebhookEvent.name)
    private webhookEventModel: Model<WebhookEventDocument>,
    @InjectModel(StripeCustomer.name)
    private stripeCustomerModel: Model<StripeCustomerDocument>,
    @InjectModel(CheckoutSession.name)
    private checkoutSessionModel: Model<CheckoutSessionDocument>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Main entry point for processing webhook events
   * Handles verification, idempotency, customer lookup, and subscription processing
   */
  async processWebhookEvent(event: Stripe.Event): Promise<ProcessWebhookResult> {
    const eventId = event.id;
    this.logger.log(`Processing webhook event: ${event.type} (${eventId})`);

    // Step 1: Check idempotency - has this event been processed before?
    const existingEvent = await this.webhookEventModel.findOne({ event_id: eventId });

    if (existingEvent?.processed) {
      this.logger.warn(`Event ${eventId} already processed, skipping`, {
        eventId,
        processedAt: existingEvent.processed_at,
      });
      return {
        success: true,
        eventId,
        processed: true,
        message: 'Event already processed',
        subscriptionId: existingEvent.processing_result?.subscription_id,
        organizationId: existingEvent.processing_result?.organization_id,
      };
    }

    // Step 2: Create or update webhook event record
    let webhookEventRecord: WebhookEventDocument;
    if (existingEvent) {
      webhookEventRecord = existingEvent;
    } else {
      webhookEventRecord = new this.webhookEventModel({
        event_id: eventId,
        event_type: event.type,
        processed: false,
        event_data: event.data,
      });
      await webhookEventRecord.save();
    }

    try {
      // Step 3: Process the event based on type
      let result: ProcessWebhookResult;

      switch (event.type) {
        case 'checkout.session.completed':
          result = await this.handleCheckoutSessionCompleted(event);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          result = await this.handleSubscriptionUpdated(event);
          break;

        case 'customer.subscription.deleted':
          result = await this.handleSubscriptionDeleted(event);
          break;

        case 'invoice.payment_succeeded':
          result = await this.handleInvoicePaymentSucceeded(event);
          break;

        case 'invoice.payment_failed':
          result = await this.handleInvoicePaymentFailed(event);
          break;

        default:
          this.logger.debug(`Unhandled event type: ${event.type}`, { eventId });
          result = {
            success: true,
            eventId,
            processed: true,
            message: `Event type ${event.type} not handled, but acknowledged`,
          };
      }

      // Step 4: Mark event as processed
      webhookEventRecord.processed = true;
      webhookEventRecord.processed_at = new Date();
      webhookEventRecord.processing_result = {
        success: result.success,
        subscription_id: result.subscriptionId,
        organization_id: result.organizationId,
      };
      await webhookEventRecord.save();

      this.logger.log(`Successfully processed event ${eventId}`, {
        eventId,
        eventType: event.type,
        result,
      });

      return result;
    } catch (error) {
      // Mark event processing as failed but don't throw (webhook should return 200)
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing webhook event ${eventId}`, {
        eventId,
        eventType: event.type,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      webhookEventRecord.processed = false;
      webhookEventRecord.processing_result = {
        success: false,
        error: errorMessage,
      };
      await webhookEventRecord.save();

      // Return success to Stripe so it doesn't retry immediately
      // The event can be manually retried later
      return {
        success: false,
        eventId,
        processed: false,
        message: `Error processing event: ${errorMessage}`,
      };
    }
  }

  /**
   * Handle checkout.session.completed event
   * This is the main event for successful payment completion
   */
  private async handleCheckoutSessionCompleted(event: Stripe.Event): Promise<ProcessWebhookResult> {
    const session = event.data.object as Stripe.Checkout.Session;
    this.logger.log(`Processing checkout.session.completed for session ${session.id}`);

    // Step 1: Lookup customer from Stripe customer ID
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (!customerId) {
      throw new BadRequestException('No customer ID found in checkout session');
    }

    // Step 2: Find customer in our database
    const customer = await this.stripeCustomerModel.findOne({
      stripe_customer_id: customerId,
    });

    if (!customer) {
      this.logger.warn(`Customer not found for checkout session ${session.id}`, {
        customerId,
        sessionId: session.id,
      });
      throw new BadRequestException(`Customer ${customerId} not found in database`);
    }

    this.logger.log(`Found customer for checkout session`, {
      customerId,
      organizationId: customer.organization_id,
      sessionId: session.id,
    });

    // Step 3: Find checkout session in our database
    const checkoutSession = await this.checkoutSessionModel.findOne({
      stripe_session_id: session.id,
    });

    if (!checkoutSession) {
      this.logger.warn(`Checkout session not found in database`, {
        sessionId: session.id,
        customerId,
      });
      // This might happen if webhook arrives before checkout/success endpoint is called
      // We'll still process it by verifying with Stripe
    }

    // Step 4: Verify subscription with Stripe SDK
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    if (!subscriptionId) {
      throw new BadRequestException('No subscription ID found in checkout session');
    }

    // Step 5: Retrieve full subscription details from Stripe
    const subscription = await this.stripeService.getSubscription(subscriptionId);
    if (!subscription) {
      throw new BadRequestException(`Subscription ${subscriptionId} not found in Stripe`);
    }

    // Step 6: Update or create subscription record in our database
    const organizationId = checkoutSession?.organization_id || customer.organization_id;
    const planId = checkoutSession?.plan_id || session.metadata?.plan_id;
    const billingInterval = checkoutSession?.billing_interval || session.metadata?.billing_interval;

    await this.upsertSubscription({
      stripeSubscriptionId: subscription.id,
      organizationId,
      stripeCustomerId: customerId,
      planId,
      billingInterval,
      subscription,
    });

    // Step 7: Update checkout session status if it exists
    if (checkoutSession) {
      checkoutSession.status = 'completed';
      checkoutSession.updated_at = new Date();
      await checkoutSession.save();
    }

    this.logger.log(`Successfully processed checkout.session.completed`, {
      sessionId: session.id,
      subscriptionId: subscription.id,
      organizationId,
    });

    return {
      success: true,
      eventId: event.id,
      processed: true,
      message: 'Checkout session completed and subscription created/updated',
      subscriptionId: subscription.id,
      organizationId,
    };
  }

  /**
   * Handle subscription updated events
   */
  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<ProcessWebhookResult> {
    const subscriptionFromEvent = event.data.object as Stripe.Subscription;
    this.logger.log(`Processing subscription ${event.type} for ${subscriptionFromEvent.id}`);

    // Find customer to get organization_id
    const customerId =
      typeof subscriptionFromEvent.customer === 'string'
        ? subscriptionFromEvent.customer
        : subscriptionFromEvent.customer?.id;

    if (!customerId) {
      throw new BadRequestException(
        `No customer ID found for subscription ${subscriptionFromEvent.id}`,
      );
    }

    const customer = await this.stripeCustomerModel.findOne({
      stripe_customer_id: customerId,
    });

    if (!customer) {
      throw new BadRequestException(
        `Customer ${customerId} not found for subscription ${subscriptionFromEvent.id}`,
      );
    }

    // Retrieve full subscription details from Stripe API
    // Webhook events may not include all fields, so we fetch the complete object
    const subscription = await this.stripeService.getSubscription(subscriptionFromEvent.id);
    if (!subscription) {
      throw new BadRequestException(`Subscription ${subscriptionFromEvent.id} not found in Stripe`);
    }

    // Update subscription in our database
    await this.upsertSubscription({
      stripeSubscriptionId: subscription.id,
      organizationId: customer.organization_id,
      stripeCustomerId: customerId,
      subscription,
    });

    return {
      success: true,
      eventId: event.id,
      processed: true,
      message: `Subscription ${event.type} processed`,
      subscriptionId: subscription.id,
      organizationId: customer.organization_id,
    };
  }

  /**
   * Handle subscription deleted events
   */
  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<ProcessWebhookResult> {
    const subscription = event.data.object as Stripe.Subscription;
    this.logger.log(`Processing subscription deletion for ${subscription.id}`);

    const subscriptionRecord = await this.subscriptionModel.findOne({
      stripe_subscription_id: subscription.id,
    });

    if (subscriptionRecord) {
      subscriptionRecord.status = 'canceled';
      subscriptionRecord.canceled_at = new Date();
      subscriptionRecord.updated_at = new Date();
      await subscriptionRecord.save();
    }

    return {
      success: true,
      eventId: event.id,
      processed: true,
      message: 'Subscription deleted',
      subscriptionId: subscription.id,
      organizationId: subscriptionRecord?.organization_id,
    };
  }

  /**
   * Handle successful invoice payment
   */
  private async handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<ProcessWebhookResult> {
    const invoice = event.data.object as Stripe.Invoice;
    this.logger.log(`Processing invoice payment succeeded for ${invoice.id}`);

    // Safely extract subscription ID from invoice
    // Use type assertion to access subscription property which may not be in strict types
    const invoiceObj = invoice as unknown as Record<string, unknown>;
    const subscription = invoiceObj.subscription;
    let subscriptionId: string | undefined;

    if (subscription) {
      if (typeof subscription === 'string') {
        subscriptionId = subscription;
      } else if (
        typeof subscription === 'object' &&
        subscription !== null &&
        'id' in subscription &&
        typeof subscription.id === 'string'
      ) {
        subscriptionId = subscription.id;
      }
    }

    if (subscriptionId) {
      const subscription = await this.stripeService.getSubscription(subscriptionId);
      if (subscription) {
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;

        if (customerId) {
          const customer = await this.stripeCustomerModel.findOne({
            stripe_customer_id: customerId,
          });

          if (customer) {
            await this.upsertSubscription({
              stripeSubscriptionId: subscription.id,
              organizationId: customer.organization_id,
              stripeCustomerId: customerId,
              subscription,
            });
          }
        }
      }
    }

    return {
      success: true,
      eventId: event.id,
      processed: true,
      message: 'Invoice payment succeeded',
      subscriptionId,
    };
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<ProcessWebhookResult> {
    const invoice = event.data.object as Stripe.Invoice;
    this.logger.log(`Processing invoice payment failed for ${invoice.id}`);

    // Safely extract subscription ID from invoice
    // Use type assertion to access subscription property which may not be in strict types
    const invoiceObj = invoice as unknown as Record<string, unknown>;
    const subscription = invoiceObj.subscription;
    let subscriptionId: string | undefined;

    if (subscription) {
      if (typeof subscription === 'string') {
        subscriptionId = subscription;
      } else if (
        typeof subscription === 'object' &&
        subscription !== null &&
        'id' in subscription &&
        typeof subscription.id === 'string'
      ) {
        subscriptionId = subscription.id;
      }
    }

    if (subscriptionId) {
      const subscriptionRecord = await this.subscriptionModel.findOne({
        stripe_subscription_id: subscriptionId,
      });

      if (subscriptionRecord) {
        // Update subscription status based on Stripe's status
        const subscription = await this.stripeService.getSubscription(subscriptionId);
        if (subscription) {
          subscriptionRecord.status = subscription.status;
          subscriptionRecord.updated_at = new Date();
          await subscriptionRecord.save();
        }
      }
    }

    return {
      success: true,
      eventId: event.id,
      processed: true,
      message: 'Invoice payment failed processed',
      subscriptionId,
    };
  }

  /**
   * Upsert subscription record in database
   */
  private async upsertSubscription(params: {
    stripeSubscriptionId: string;
    organizationId: string;
    stripeCustomerId: string;
    planId?: string;
    billingInterval?: string;
    subscription: Stripe.Subscription;
  }): Promise<SubscriptionDocument> {
    const subscriptionObj = params.subscription as unknown as Record<string, unknown>;

    // Helper function to safely convert Unix timestamp to Date
    const toDate = (timestamp: unknown): Date | undefined => {
      if (timestamp === null || timestamp === undefined) {
        return undefined;
      }
      const numTimestamp = typeof timestamp === 'number' ? timestamp : Number(timestamp);
      if (isNaN(numTimestamp) || numTimestamp <= 0) {
        const timestampStr =
          typeof timestamp === 'string'
            ? timestamp
            : typeof timestamp === 'number'
              ? String(timestamp)
              : JSON.stringify(timestamp);
        this.logger.warn(`Invalid timestamp value: ${timestampStr}`, {
          subscriptionId: params.stripeSubscriptionId,
        });
        return undefined;
      }
      return new Date(numTimestamp * 1000);
    };

    // Safely extract and convert date fields from subscription object
    // First try root level (standard Stripe API response)
    let currentPeriodStartRaw = subscriptionObj.current_period_start;
    let currentPeriodEndRaw = subscriptionObj.current_period_end;
    const canceledAtRaw = subscriptionObj.canceled_at;

    // Fallback: If not at root level, try to get from subscription items
    // This handles cases where Stripe API returns these fields nested in items.data[0]
    // (common in webhook events or certain API versions)
    if (
      (currentPeriodStartRaw === undefined || currentPeriodEndRaw === undefined) &&
      params.subscription.items &&
      params.subscription.items.data &&
      params.subscription.items.data.length > 0
    ) {
      const firstItem = params.subscription.items.data[0] as unknown as Record<string, unknown>;
      if (
        currentPeriodStartRaw === undefined &&
        typeof firstItem.current_period_start === 'number'
      ) {
        currentPeriodStartRaw = firstItem.current_period_start;
        this.logger.debug('Using current_period_start from subscription item instead of root', {
          subscriptionId: params.stripeSubscriptionId,
        });
      }
      if (currentPeriodEndRaw === undefined && typeof firstItem.current_period_end === 'number') {
        currentPeriodEndRaw = firstItem.current_period_end;
        this.logger.debug('Using current_period_end from subscription item instead of root', {
          subscriptionId: params.stripeSubscriptionId,
        });
      }
    }

    // Log warning if fields are still missing after fallback
    if (currentPeriodStartRaw === undefined || currentPeriodEndRaw === undefined) {
      const availableKeys = Object.keys(subscriptionObj).slice(0, 20); // Log first 20 keys
      this.logger.warn(
        `Missing date fields in subscription object. Available keys: ${availableKeys.join(', ')}`,
        {
          subscriptionId: params.stripeSubscriptionId,
          hasCurrentPeriodStart: currentPeriodStartRaw !== undefined,
          hasCurrentPeriodEnd: currentPeriodEndRaw !== undefined,
          hasItems: !!params.subscription.items,
          itemsLength: params.subscription.items?.data?.length || 0,
        },
      );
    }

    const currentPeriodStart = toDate(currentPeriodStartRaw);
    const currentPeriodEnd = toDate(currentPeriodEndRaw);
    const canceledAt = toDate(canceledAtRaw);

    // Validate required date fields
    if (!currentPeriodStart || !currentPeriodEnd) {
      const startStr =
        currentPeriodStartRaw !== undefined
          ? typeof currentPeriodStartRaw === 'string' || typeof currentPeriodStartRaw === 'number'
            ? String(currentPeriodStartRaw)
            : JSON.stringify(currentPeriodStartRaw)
          : 'undefined';
      const endStr =
        currentPeriodEndRaw !== undefined
          ? typeof currentPeriodEndRaw === 'string' || typeof currentPeriodEndRaw === 'number'
            ? String(currentPeriodEndRaw)
            : JSON.stringify(currentPeriodEndRaw)
          : 'undefined';
      throw new BadRequestException(
        `Missing required date fields for subscription ${params.stripeSubscriptionId}. ` +
          `current_period_start: ${startStr}, ` +
          `current_period_end: ${endStr}. ` +
          `Please ensure the subscription object contains these fields.`,
      );
    }

    const subscriptionData = {
      stripe_subscription_id: params.stripeSubscriptionId,
      organization_id: params.organizationId,
      stripe_customer_id: params.stripeCustomerId,
      plan_id: params.planId,
      billing_interval: params.billingInterval,
      status: params.subscription.status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: params.subscription.cancel_at_period_end || false,
      canceled_at: canceledAt,
      metadata: params.subscription.metadata as Record<string, string> | undefined,
      stripe_data: params.subscription as unknown as Record<string, unknown>,
      updated_at: new Date(),
    };

    const subscriptionRecord = await this.subscriptionModel.findOneAndUpdate(
      { stripe_subscription_id: params.stripeSubscriptionId },
      subscriptionData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    // Set created_at only on insert
    if (!subscriptionRecord.created_at) {
      subscriptionRecord.created_at = new Date();
      await subscriptionRecord.save();
    }

    this.logger.log(`Upserted subscription ${params.stripeSubscriptionId}`, {
      subscriptionId: params.stripeSubscriptionId,
      organizationId: params.organizationId,
      status: subscriptionRecord.status,
    });

    return subscriptionRecord;
  }
}
