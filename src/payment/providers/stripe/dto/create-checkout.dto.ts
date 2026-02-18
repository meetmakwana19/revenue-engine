import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsNotEmpty({ message: 'subscription_plan_uid is required' })
  @IsString({ message: 'subscription_plan_uid must be a string' })
  subscription_plan_uid: string;

  @IsNotEmpty({ message: 'billing_interval is required' })
  @IsEnum(['month', 'year'], { message: 'billing_interval must be either "month" or "year"' })
  billing_interval: 'month' | 'year';

  @IsOptional()
  @IsBoolean({ message: 'overages_enabled must be a boolean' })
  overages_enabled?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'overage_bandwidth must be a boolean' })
  overage_bandwidth?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'overage_api must be a boolean' })
  overage_api?: boolean;
}
