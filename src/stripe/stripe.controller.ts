import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreatePriceDto } from './dto/create-price.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  // Customer endpoints
  @Post('customers')
  @HttpCode(HttpStatus.CREATED)
  async createCustomer(@Body() createCustomerDto: CreateCustomerDto) {
    return await this.stripeService.createCustomer(createCustomerDto.email, createCustomerDto.name);
  }

  @Get('customers')
  async listCustomers(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return await this.stripeService.listCustomers(limitNum);
  }

  @Get('customers/:id')
  async getCustomer(@Param('id') id: string) {
    return await this.stripeService.getCustomer(id);
  }

  @Put('customers/:id')
  async updateCustomer(
    @Param('id') id: string,
    @Body()
    data: { email?: string; name?: string; metadata?: Record<string, string> },
  ) {
    return await this.stripeService.updateCustomer(id, data);
  }

  @Delete('customers/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCustomer(@Param('id') id: string) {
    return await this.stripeService.deleteCustomer(id);
  }

  // Payment Intent endpoints
  @Post('payment-intents')
  @HttpCode(HttpStatus.CREATED)
  async createPaymentIntent(@Body() createPaymentIntentDto: CreatePaymentIntentDto) {
    return await this.stripeService.createPaymentIntent(
      createPaymentIntentDto.amount,
      createPaymentIntentDto.currency,
      createPaymentIntentDto.customerId,
      createPaymentIntentDto.metadata,
    );
  }

  @Get('payment-intents/:id')
  async getPaymentIntent(@Param('id') id: string) {
    return await this.stripeService.getPaymentIntent(id);
  }

  @Post('payment-intents/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPaymentIntent(@Param('id') id: string) {
    return await this.stripeService.confirmPaymentIntent(id);
  }

  @Post('payment-intents/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelPaymentIntent(@Param('id') id: string) {
    return await this.stripeService.cancelPaymentIntent(id);
  }

  // Product endpoints
  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  async createProduct(@Body() createProductDto: CreateProductDto) {
    return await this.stripeService.createProduct(
      createProductDto.name,
      createProductDto.description,
      createProductDto.images,
    );
  }

  @Get('products')
  async listProducts(@Query('limit') limit?: string, @Query('active') active?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const activeBool = active === undefined ? true : active.toLowerCase() === 'true';
    return await this.stripeService.listProducts(limitNum, activeBool);
  }

  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    return await this.stripeService.getProduct(id);
  }

  @Put('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string; images?: string[] },
  ) {
    return await this.stripeService.updateProduct(id, data);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.OK)
  async deleteProduct(@Param('id') id: string) {
    return await this.stripeService.deleteProduct(id);
  }

  // Price endpoints
  @Post('prices')
  @HttpCode(HttpStatus.CREATED)
  async createPrice(@Body() createPriceDto: CreatePriceDto) {
    return await this.stripeService.createPrice(
      createPriceDto.productId,
      createPriceDto.unitAmount,
      createPriceDto.currency,
      createPriceDto.recurring,
    );
  }

  @Get('prices')
  async listPrices(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return await this.stripeService.listPrices(limitNum);
  }

  @Get('prices/:id')
  async getPrice(@Param('id') id: string) {
    return await this.stripeService.getPrice(id);
  }

  // Subscription endpoints
  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return await this.stripeService.createSubscription(
      createSubscriptionDto.customerId,
      createSubscriptionDto.items,
      createSubscriptionDto.metadata,
    );
  }

  @Get('subscriptions')
  async listSubscriptions(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return await this.stripeService.listSubscriptions(limitNum);
  }

  @Get('subscriptions/:id')
  async getSubscription(@Param('id') id: string) {
    return await this.stripeService.getSubscription(id);
  }

  @Post('subscriptions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@Param('id') id: string) {
    return await this.stripeService.cancelSubscription(id);
  }

  // Health check endpoint
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      message: 'Stripe service is running',
      timestamp: new Date().toISOString(),
    };
  }
}
