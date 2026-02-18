import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export class PriceDto {
  @IsNotEmpty({ message: 'Price id is required' })
  @IsString({ message: 'Price id must be a string' })
  id: string;

  @IsNotEmpty({ message: 'Price interval is required' })
  @IsString({ message: 'Price interval must be a string' })
  @IsIn(['month', 'year', 'week', 'day'], {
    message: 'Price interval must be one of: month, year, week, day',
  })
  interval: string;
}

export class MetadataDto {
  @IsNotEmpty({ message: 'Product UID is required' })
  @IsString({ message: 'Product UID must be a string' })
  product_uid: string;
}

export class UpdateSubscriptionPlanDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;

  @IsOptional()
  @IsArray({ message: 'Prices must be an array' })
  @ValidateNested({ each: true })
  @Type(() => PriceDto)
  prices?: PriceDto[];
}
