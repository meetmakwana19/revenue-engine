import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { IncomingHttpHeaders } from 'http';
import { CheckoutHeadersDto, ICheckoutHeaders } from '../dto/checkout-headers.dto';

/**
 * Custom decorator to extract and validate checkout headers
 *
 * Usage:
 * @Post('checkout')
 * async createCheckout(
 *   @CheckoutHeaders() headers: ICheckoutHeaders,
 *   @Body() createCheckoutDto: CreateCheckoutDto
 * ) { ... }
 */
export const CheckoutHeaders = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext): Promise<ICheckoutHeaders> => {
    const request = ctx.switchToHttp().getRequest<{ headers: IncomingHttpHeaders }>();
    const headers: IncomingHttpHeaders = request.headers;

    // Helper to extract header value as string (handles string | string[] | undefined)
    const getHeaderValue = (key: string): string | undefined => {
      const value = headers[key.toLowerCase()] || headers[key];
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;
    };

    // Extract headers (case-insensitive)
    const orgId = getHeaderValue('x-organization-id');
    const customerEmail = getHeaderValue('x-customer-email');

    // Create DTO instance for validation
    const dto = plainToInstance(CheckoutHeadersDto, {
      'x-organization-id': orgId,
      'x-customer-email': customerEmail,
    });

    // Validate
    const errors = await validate(dto);

    if (errors.length > 0) {
      const errorMessages = errors
        .map((error) => Object.values(error.constraints || {}).join(', '))
        .join('; ');
      throw new BadRequestException(`Invalid headers: ${errorMessages}`);
    }

    // Return normalized camelCase object
    return {
      organizationId: (orgId || '').trim(),
      customerEmail: (customerEmail || '').trim(),
    };
  },
);
