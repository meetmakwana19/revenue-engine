import { IsNotEmpty, IsString } from 'class-validator';

export class AttachFeatureToProductDto {
  @IsNotEmpty({ message: 'entitlement_feature is required' })
  @IsString({ message: 'entitlement_feature must be a string' })
  entitlement_feature: string;
}
