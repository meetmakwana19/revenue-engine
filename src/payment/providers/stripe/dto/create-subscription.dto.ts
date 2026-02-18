export class CreateSubscriptionDto {
  customerId: string;
  items: Array<{ price: string }>;
  metadata?: Record<string, string>;
}
