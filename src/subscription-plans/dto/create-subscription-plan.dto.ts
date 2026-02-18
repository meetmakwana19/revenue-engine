import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

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

export class CreateSubscriptionPlanDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @IsNotEmpty({ message: 'Metadata is required' })
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata: MetadataDto;

  @IsNotEmpty({ message: 'Prices are required' })
  @IsArray({ message: 'Prices must be an array' })
  @ArrayMinSize(1, { message: 'At least one price is required' })
  @ValidateNested({ each: true })
  @Type(() => PriceDto)
  prices: PriceDto[];
}
