export class CreatePaymentIntentDto {
  // Option 1: Direct amount (for one-time payments)
  amount?: number;
  currency?: string;

  // Option 2: Product/Price ID (recommended - matches your current payment link setup)
  priceId?: string;
  productId?: string;

  // Customer information
  customerId?: string;
  customerEmail?: string;

  // Metadata for tracking
  metadata?: Record<string, string>;

  // Payment method configuration
  paymentMethodTypes?: string[];
  automaticPaymentMethods?: {
    enabled: boolean;
    allowRedirects?: 'always' | 'never';
  };
}
