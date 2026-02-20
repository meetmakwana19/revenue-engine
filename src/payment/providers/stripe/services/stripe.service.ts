import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { CheckoutSession, CheckoutSessionDocument } from '../schemas/checkout-session.schema';
import { StripeCustomer, StripeCustomerDocument } from '../schemas/stripe-customer.schema';

export interface PriceValidationResult {
  valid: boolean;
  error?: string;
  price?: Stripe.Price;
}

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    @InjectModel(StripeCustomer.name)
    private stripeCustomerModel: Model<StripeCustomerDocument>,
    @InjectModel(CheckoutSession.name)
    private checkoutSessionModel: Model<CheckoutSessionDocument>,
  ) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }

    this.stripe = new Stripe(secretKey, {
      typescript: true,
    });
  }

  onModuleInit() {
    this.logger.log('Stripe module initialized');
  }

  getStripe(): Stripe {
    return this.stripe;
  }

  // Customer methods
  async createCustomer(email: string, name?: string) {
    return await this.stripe.customers.create({
      email,
      name,
    });
  }

  async getCustomer(customerId: string) {
    return await this.stripe.customers.retrieve(customerId);
  }

  async listCustomers(limit: number = 10) {
    return await this.stripe.customers.list({ limit });
  }

  async updateCustomer(customerId: string, data: Stripe.CustomerUpdateParams) {
    return await this.stripe.customers.update(customerId, data);
  }

  async deleteCustomer(customerId: string) {
    return await this.stripe.customers.del(customerId);
  }

  // Payment Intent methods
  async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId?: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    const params: Stripe.PaymentIntentCreateParams = {
      amount,
      currency,
      metadata,
    };

    if (customerId) {
      params.customer = customerId;
    }

    return await this.stripe.paymentIntents.create(params);
  }

  // Enhanced Payment Intent creation with product/price support
  async createPaymentIntentWithProduct(params: {
    priceId?: string;
    productId?: string;
    amount?: number;
    currency?: string;
    customerId?: string;
    customerEmail?: string;
    metadata?: Record<string, string>;
    paymentMethodTypes?: string[];
    automaticPaymentMethods?: {
      enabled: boolean;
      allowRedirects?: 'always' | 'never';
    };
  }): Promise<Stripe.PaymentIntent> {
    let amount: number;
    let currency: string = params.currency || 'usd';

    // If priceId is provided, fetch the price to get amount and currency
    if (params.priceId) {
      const price = await this.stripe.prices.retrieve(params.priceId);
      if (!price.unit_amount) {
        throw new Error('Price does not have a unit_amount');
      }
      amount = price.unit_amount;
      currency = price.currency;
    } else if (params.amount) {
      // Use direct amount if provided
      amount = params.amount;
    } else {
      throw new Error('Either priceId or amount must be provided');
    }

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount,
      currency,
      metadata: params.metadata,
    };

    // Handle customer
    if (params.customerId) {
      paymentIntentParams.customer = params.customerId;
    } else if (params.customerEmail) {
      // Create or retrieve customer by email
      const customers = await this.stripe.customers.list({
        email: params.customerEmail,
        limit: 1,
      });
      if (customers.data.length > 0) {
        paymentIntentParams.customer = customers.data[0].id;
      } else {
        const customer = await this.stripe.customers.create({
          email: params.customerEmail,
        });
        paymentIntentParams.customer = customer.id;
      }
    }

    // Payment method configuration
    if (params.paymentMethodTypes) {
      paymentIntentParams.payment_method_types = params.paymentMethodTypes;
    }

    if (params.automaticPaymentMethods) {
      paymentIntentParams.automatic_payment_methods = {
        enabled: params.automaticPaymentMethods.enabled,
        allow_redirects: params.automaticPaymentMethods.allowRedirects,
      };
    }

    return await this.stripe.paymentIntents.create(paymentIntentParams);
  }

  // Create Checkout Session (alternative approach - better for custom UI)
  async createCheckoutSession(params: {
    priceId?: string;
    productId?: string;
    amount?: number;
    currency?: string;
    customerId?: string;
    customerEmail?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    mode?: 'payment' | 'subscription' | 'setup';
  }): Promise<Stripe.Checkout.Session> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: params.mode || 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    };

    // Handle customer
    if (params.customerId) {
      sessionParams.customer = params.customerId;
    } else if (params.customerEmail) {
      sessionParams.customer_email = params.customerEmail;
    }

    // Handle line items
    if (params.priceId) {
      sessionParams.line_items = [
        {
          price: params.priceId,
          quantity: 1, // Could be multiple items based on user's selection if configures such.
        },
      ];
    } else if (params.productId && params.amount) {
      sessionParams.line_items = [
        {
          price_data: {
            currency: params.currency || 'usd',
            product: params.productId,
            unit_amount: params.amount,
          },
          quantity: 1,
        },
      ];
    } else if (params.amount) {
      sessionParams.line_items = [
        {
          price_data: {
            currency: params.currency || 'usd',
            product_data: {
              name: 'Custom Payment',
            },
            unit_amount: params.amount,
          },
          quantity: 1,
        },
      ];
    } else {
      throw new Error('Either priceId, productId+amount, or amount must be provided');
    }

    return await this.stripe.checkout.sessions.create(sessionParams);
  }

  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.retrieve(sessionId);
  }

  // Create or retrieve Stripe customer for organization
  async getOrCreateCustomer(
    organizationId: string,
    email?: string,
  ): Promise<StripeCustomerDocument> {
    // Check if customer already exists in MongoDB
    let customer = await this.stripeCustomerModel.findOne({
      organization_id: organizationId,
    });

    if (customer) {
      // Validate email matches existing customer email
      // This prevents unauthorized email changes during checkout
      // Email updates should be done through a proper profile update endpoint
      if (email && customer.email && customer.email !== email) {
        throw new BadRequestException('Email mismatch between customer and checkout request.');
      }

      // If customer exists but doesn't have an email yet, and one is provided, update it
      if (email && !customer.email) {
        await this.stripe.customers.update(customer.stripe_customer_id, { email });
        customer.email = email;
        await customer.save();
      }

      return customer;
    }

    // Validate email is provided when creating a new customer
    // Email is required for checkout flows to send receipts/invoices
    if (!email || !email.trim()) {
      throw new Error(
        'Email is required when creating a new customer. Customer email is needed for checkout, invoices, and receipts.',
      );
    }

    // Create customer in Stripe
    const stripeCustomer = await this.stripe.customers.create({
      email,
      metadata: {
        organization_id: organizationId,
      },
    });

    // Save to MongoDB
    customer = new this.stripeCustomerModel({
      organization_id: organizationId,
      stripe_customer_id: stripeCustomer.id,
      email: stripeCustomer.email || email,
      stripe_data: stripeCustomer,
    });

    return await customer.save();
  }

  // Create checkout session with persistence
  async createCheckoutSessionWithPersistence(params: {
    organizationId: string;
    planId: string;
    billingInterval: 'month' | 'year';
    priceId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    overagesEnabled?: boolean;
    overageBandwidth?: boolean;
    overageApi?: boolean;
  }): Promise<{ checkout_url: string; session_id: string }> {
    // Validate customer email is provided
    if (!params.customerEmail || !params.customerEmail.trim()) {
      throw new Error('Customer email is required for checkout');
    }

    // Get or create customer
    const customer = await this.getOrCreateCustomer(params.organizationId, params.customerEmail);

    // Create checkout session in Stripe
    const session = await this.createCheckoutSession({
      priceId: params.priceId,
      customerId: customer.stripe_customer_id,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      metadata: {
        ...params.metadata,
        organization_id: params.organizationId,
        plan_id: params.planId,
        billing_interval: params.billingInterval,
        overages_enabled: String(params.overagesEnabled || false),
        overage_bandwidth: String(params.overageBandwidth || false),
        overage_api: String(params.overageApi || false),
      },
      mode: 'subscription', // Assuming subscription mode for plans
    });

    // Save checkout session to MongoDB
    const checkoutSession = new this.checkoutSessionModel({
      organization_id: params.organizationId,
      stripe_session_id: session.id,
      stripe_customer_id: customer.stripe_customer_id,
      plan_id: params.planId,
      billing_interval: params.billingInterval,
      metadata: {
        ...params.metadata,
        overages_enabled: String(params.overagesEnabled || false),
        overage_bandwidth: String(params.overageBandwidth || false),
        overage_api: String(params.overageApi || false),
      },
      status: 'pending',
    });

    await checkoutSession.save();

    return {
      checkout_url: session.url || '',
      session_id: session.id,
    };
  }

  // Verify checkout session and get subscription info
  async verifyCheckoutSession(sessionId: string): Promise<{
    subscription: {
      id: string;
      organization_id: string;
      plan_id: string;
      billing_interval: string;
      status: string;
      current_period_start: string;
      current_period_end: string;
      cancel_at_period_end: boolean;
      overages_enabled: boolean;
      created_at: string;
      product?: {
        id: string;
        name: string;
        description: string | null;
        images: string[];
        metadata: Record<string, string>;
      };
      price?: {
        id: string;
        unit_amount: number | null;
        currency: string;
        recurring: {
          interval: string;
          interval_count: number;
        } | null;
        metadata: Record<string, string>;
      };
    } | null;
    error?: string;
  }> {
    try {
      // Retrieve session from Stripe with expanded line items (product and price)
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items.data.price.product'],
      });

      this.logger.log('Session retrieved', { sessionId, status: session.status });

      if (session.status !== 'complete') {
        this.logger.warn(
          `Checkout session verification failed: Session status is '${session.status}', expected 'complete'`,
          { sessionId, actualStatus: session.status },
        );
        return {
          subscription: null,
          error: `Session status is '${session.status}', expected 'complete'`,
        };
      }

      // Find checkout session in MongoDB
      const checkoutSession = await this.checkoutSessionModel.findOne({
        stripe_session_id: sessionId,
      });

      if (!checkoutSession) {
        this.logger.warn(
          `Checkout session verification failed: Checkout session not found in MongoDB`,
          { sessionId },
        );
        return {
          subscription: null,
          error: 'Checkout session not found in database',
        };
      }

      // Get subscription from Stripe
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

      if (!subscriptionId) {
        this.logger.warn(
          `Checkout session verification failed: No subscription ID found in session`,
          { sessionId, subscription: session.subscription },
        );
        return {
          subscription: null,
          error: 'No subscription ID found in checkout session',
        };
      }

      // Retrieve subscription with expanded items (price and product)
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price.product'],
      });

      this.logger.log('Subscription retrieved', subscription);

      // Update checkout session status
      checkoutSession.status = 'completed';
      await checkoutSession.save();

      // Extract metadata
      const metadata = checkoutSession.metadata || {};
      const overagesEnabled = metadata.overages_enabled === 'true';

      // Access subscription properties - current_period_start and current_period_end are at root level
      // Access them directly from the subscription object using type assertion to bypass TypeScript limitations
      const subscriptionObj = subscription as unknown as Record<string, unknown>;
      let currentPeriodStart = subscriptionObj.current_period_start;
      let currentPeriodEnd = subscriptionObj.current_period_end;
      const created = subscription.created;

      // Fallback: If not at root level, try to get from subscription items
      // This handles cases where the API response structure might differ
      if (
        (typeof currentPeriodStart !== 'number' || typeof currentPeriodEnd !== 'number') &&
        subscription.items &&
        subscription.items.data &&
        subscription.items.data.length > 0
      ) {
        const firstItem = subscription.items.data[0] as unknown as Record<string, unknown>;
        if (typeof firstItem.current_period_start === 'number') {
          currentPeriodStart = firstItem.current_period_start;
          this.logger.warn('Using current_period_start from subscription item instead of root', {
            sessionId,
            subscriptionId,
          });
        }
        if (typeof firstItem.current_period_end === 'number') {
          currentPeriodEnd = firstItem.current_period_end;
          this.logger.warn('Using current_period_end from subscription item instead of root', {
            sessionId,
            subscriptionId,
          });
        }
      }

      // Ensure subscription has required properties
      if (
        typeof currentPeriodStart !== 'number' ||
        typeof currentPeriodEnd !== 'number' ||
        typeof created !== 'number'
      ) {
        this.logger.error(`Checkout session verification failed: Invalid subscription properties`, {
          sessionId,
          subscriptionId,
          currentPeriodStart: typeof currentPeriodStart,
          currentPeriodEnd: typeof currentPeriodEnd,
          created: typeof created,
          currentPeriodStartValue: currentPeriodStart,
          currentPeriodEndValue: currentPeriodEnd,
          createdValue: created,
          subscriptionKeys: Object.keys(subscriptionObj),
          hasItems: !!subscription.items,
          itemsLength: subscription.items?.data?.length || 0,
        });
        return {
          subscription: null,
          error: `Invalid subscription properties: current_period_start=${typeof currentPeriodStart}, current_period_end=${typeof currentPeriodEnd}, created=${typeof created}`,
        };
      }

      // Extract product and price details from subscription items
      let productDetails:
        | {
            id: string;
            name: string;
            description: string | null;
            images: string[];
            metadata: Record<string, string>;
          }
        | undefined;

      let priceDetails:
        | {
            id: string;
            unit_amount: number | null;
            currency: string;
            recurring: {
              interval: string;
              interval_count: number;
            } | null;
            metadata: Record<string, string>;
          }
        | undefined;

      // Get product and price from the first subscription item
      if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
        const firstItem = subscription.items.data[0];
        const price = firstItem.price;

        if (price) {
          // Extract price details
          priceDetails = {
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            recurring: price.recurring
              ? {
                  interval: price.recurring.interval,
                  interval_count: price.recurring.interval_count,
                }
              : null,
            metadata: price.metadata || {},
          };

          // Extract product details if expanded
          if (typeof price.product !== 'string' && price.product) {
            const product = price.product as Stripe.Product;
            productDetails = {
              id: product.id,
              name: product.name,
              description: product.description,
              images: product.images || [],
              metadata: product.metadata || {},
            };
          }
        }
      }

      this.logger.log('Checkout session verified successfully', {
        sessionId,
        subscriptionId,
        organizationId: checkoutSession.organization_id,
      });

      return {
        subscription: {
          id: subscription.id,
          organization_id: checkoutSession.organization_id,
          plan_id: checkoutSession.plan_id || '',
          billing_interval: checkoutSession.billing_interval || 'month',
          status: subscription.status,
          current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
          current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end || false,
          overages_enabled: overagesEnabled,
          created_at: new Date(created * 1000).toISOString(),
          product: productDetails,
          price: priceDetails,
        },
      };
    } catch (error) {
      this.logger.error(`Checkout session verification failed: Unexpected error`, {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        subscription: null,
        error: `Unexpected error during verification: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async getPaymentIntent(paymentIntentId: string) {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  async confirmPaymentIntent(paymentIntentId: string) {
    return await this.stripe.paymentIntents.confirm(paymentIntentId);
  }

  async cancelPaymentIntent(paymentIntentId: string) {
    return await this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  // Product methods
  async createProduct(name: string, description?: string, images?: string[]) {
    return await this.stripe.products.create({
      name,
      description,
      images,
    });
  }

  async getProduct(productId: string) {
    return await this.stripe.products.retrieve(productId);
  }

  async listProducts(limit: number = 10, active: boolean = true) {
    const response = await this.stripe.products.list({ limit, active });

    // Stripe API doesn't provide total count in the response
    // We can only return the current page count
    return {
      ...response,
      currentCount: response.data.length,
      hasMore: response.has_more,
    };
  }

  async updateProduct(productId: string, data: Stripe.ProductUpdateParams) {
    return await this.stripe.products.update(productId, data);
  }

  async deleteProduct(productId: string) {
    return await this.stripe.products.del(productId);
  }

  // Price methods
  async createPrice(
    productId: string,
    unitAmount: number,
    currency: string = 'usd',
    recurring?: Stripe.PriceCreateParams.Recurring,
  ) {
    return await this.stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency,
      recurring,
    });
  }

  async getPrice(priceId: string, expand?: string[]) {
    return await this.stripe.prices.retrieve(priceId, {
      expand: expand || [],
    });
  }

  /**
   * Validates a Stripe price ID by checking:
   * 1. Format (should start with 'price_')
   * 2. Existence in Stripe
   * 3. Active status
   * 4. Optional: billing interval match for recurring prices
   */
  async validatePriceId(
    priceId: string,
    expectedBillingInterval?: 'month' | 'year',
  ): Promise<PriceValidationResult> {
    // Validate format
    if (!priceId || typeof priceId !== 'string') {
      return { valid: false, error: 'Price ID must be a non-empty string' };
    }

    if (!priceId.startsWith('price_')) {
      return {
        valid: false,
        error: `Invalid price ID format. Price IDs must start with 'price_'`,
      };
    }

    try {
      // Verify price exists in Stripe and expand product details
      const price = await this.stripe.prices.retrieve(priceId, {
        expand: ['product'],
      });

      // Check if price is active
      if (!price.active) {
        return {
          valid: false,
          error: `Price ID ${priceId} is not active`,
          price,
        };
      }

      // If billing interval is expected, validate it matches for recurring prices
      if (expectedBillingInterval && price.recurring) {
        const priceInterval = price.recurring.interval;
        if (priceInterval !== expectedBillingInterval) {
          return {
            valid: false,
            error: `Price ID ${priceId} has billing interval '${priceInterval}' but received '${expectedBillingInterval}'`,
            price,
          };
        }
      }

      return { valid: true, price };
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        if (error.type === 'StripeInvalidRequestError') {
          return {
            valid: false,
            error: `Price ID ${priceId} does not exist in Stripe`,
          };
        }
        return {
          valid: false,
          error: `Stripe error: ${error.message}`,
        };
      }
      return {
        valid: false,
        error: `Failed to validate price ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async listPrices(limit: number = 10) {
    return await this.stripe.prices.list({ limit });
  }

  // Subscription methods
  async createSubscription(
    customerId: string,
    items: Array<{ price: string }>,
    metadata?: Record<string, string>,
  ) {
    return await this.stripe.subscriptions.create({
      customer: customerId,
      items,
      metadata,
    });
  }

  async getSubscription(subscriptionId: string) {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async listSubscriptions(limit: number = 10) {
    return await this.stripe.subscriptions.list({ limit });
  }

  async cancelSubscription(subscriptionId: string) {
    return await this.stripe.subscriptions.cancel(subscriptionId);
  }

  // Webhook methods
  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
