import { Injectable, OnModuleInit } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
    }

    this.stripe = new Stripe(secretKey, {
      typescript: true,
    });
  }

  onModuleInit() {
    console.log('Stripe module initialized');
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
  ) {
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

  async listProducts(limit: number = 10) {
    return await this.stripe.products.list({ limit });
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

  async getPrice(priceId: string) {
    return await this.stripe.prices.retrieve(priceId);
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
