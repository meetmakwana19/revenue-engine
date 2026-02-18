export class CreateCheckoutDto {
  plan_id: string;
  billing_interval: 'month' | 'year';
  overages_enabled?: boolean;
  overage_bandwidth?: boolean;
  overage_api?: boolean;
  priceId: string;
}
