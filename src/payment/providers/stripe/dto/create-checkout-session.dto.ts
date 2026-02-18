export class CreateCheckoutSessionDto {
  // Option 1: Price ID (recommended - matches your current payment link setup)
  priceId?: string;

  // Option 2: Product ID with amount
  productId?: string;
  amount?: number;
  currency?: string;

  // Option 3: Direct amount (for custom products)
  // amount?: number;
  // currency?: string;

  // Customer information
  customerId?: string;
  customerEmail?: string;

  // Redirect URLs
  successUrl: string;
  cancelUrl: string;

  // Metadata for tracking
  metadata?: Record<string, string>;

  // Session mode
  mode?: 'payment' | 'subscription' | 'setup';
}
