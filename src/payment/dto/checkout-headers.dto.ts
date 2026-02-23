import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Header DTO for checkout requests
 * Contains organization and customer information from headers
 */
export class CheckoutHeadersDto {
  @IsNotEmpty({ message: 'X-Organization-Id header is required' })
  @IsString({ message: 'X-Organization-Id must be a string' })
  'x-organization-id': string;

  @IsNotEmpty({ message: 'X-Customer-Email header is required' })
  @IsEmail({}, { message: 'X-Customer-Email must be a valid email address' })
  'x-customer-email': string;

  @IsNotEmpty({ message: 'X-Region header is required' })
  @IsString({ message: 'X-Region must be a string' })
  'x-region': string;
}

/**
 * Parsed checkout headers with camelCase properties
 */
export interface ICheckoutHeaders {
  organizationId: string;
  customerEmail: string;
  region: string;
}

/**
 * Raw headers from request (case-insensitive)
 */
export interface RawCheckoutHeaders {
  'x-organization-id'?: string;
  'X-Organization-Id'?: string;
  'x-customer-email'?: string;
  'X-Customer-Email'?: string;
  'x-region'?: string;
  'X-Region'?: string;
}
