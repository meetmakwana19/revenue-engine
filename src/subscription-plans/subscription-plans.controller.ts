import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import {
  ConflictError,
  NotFoundError,
  SubscriptionPlansService,
  ValidationError,
} from './subscription-plans.service';

@Controller('subscription-plans')
export class SubscriptionPlansController {
  private readonly logger = new Logger(SubscriptionPlansController.name);

  constructor(private readonly subscriptionPlansService: SubscriptionPlansService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSubscriptionPlanDto: CreateSubscriptionPlanDto) {
    try {
      // Validate that name is provided
      if (!createSubscriptionPlanDto.name || createSubscriptionPlanDto.name.trim() === '') {
        throw new BadRequestException('Name is required and cannot be empty');
      }

      // Validate metadata
      if (!createSubscriptionPlanDto.metadata?.product_uid) {
        throw new BadRequestException('Metadata with product_uid is required');
      }

      // Validate prices - must have at least one price
      if (!createSubscriptionPlanDto.prices || createSubscriptionPlanDto.prices.length === 0) {
        throw new BadRequestException('At least one price is required');
      }

      // Validate each price has both id and interval
      for (const price of createSubscriptionPlanDto.prices) {
        if (!price.id || !price.interval) {
          throw new BadRequestException('Each price must have both id and interval');
        }
      }

      return await this.subscriptionPlansService.create(createSubscriptionPlanDto);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof ConflictError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Error creating subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        `Failed to create subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @Get()
  async findAll(@Query('limit') limit?: string, @Query('skip') skip?: string) {
    try {
      // Validate and parse limit
      let limitNum: number | undefined;
      if (limit !== undefined) {
        limitNum = parseInt(limit, 10);
        if (isNaN(limitNum) || limitNum < 0) {
          throw new BadRequestException('Limit must be a non-negative integer');
        }
      }

      // Validate and parse skip
      let skipNum: number | undefined;
      if (skip !== undefined) {
        skipNum = parseInt(skip, 10);
        if (isNaN(skipNum) || skipNum < 0) {
          throw new BadRequestException('Skip must be a non-negative integer');
        }
      }

      return await this.subscriptionPlansService.findAll(limitNum, skipNum);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Error fetching subscription plans: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        `Failed to fetch subscription plans: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @Get(':subscription_plan_uid')
  async findOne(@Param('subscription_plan_uid') subscription_plan_uid: string) {
    try {
      if (!subscription_plan_uid || subscription_plan_uid.trim() === '') {
        throw new BadRequestException('Subscription plan UID is required');
      }

      return await this.subscriptionPlansService.findOne(subscription_plan_uid);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error fetching subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        `Failed to fetch subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @Patch(':subscription_plan_uid')
  async update(
    @Param('subscription_plan_uid') subscription_plan_uid: string,
    @Body() updateSubscriptionPlanDto: UpdateSubscriptionPlanDto,
  ) {
    try {
      if (!subscription_plan_uid || subscription_plan_uid.trim() === '') {
        throw new BadRequestException('Subscription plan UID is required');
      }

      // Validate that at least one field is being updated
      if (
        !updateSubscriptionPlanDto.name &&
        !updateSubscriptionPlanDto.metadata &&
        !updateSubscriptionPlanDto.prices
      ) {
        throw new BadRequestException('At least one field must be provided for update');
      }

      // Validate name if provided
      if (updateSubscriptionPlanDto.name !== undefined) {
        if (!updateSubscriptionPlanDto.name || updateSubscriptionPlanDto.name.trim() === '') {
          throw new BadRequestException('Name cannot be empty');
        }
      }

      // Validate metadata if provided
      if (updateSubscriptionPlanDto.metadata) {
        if (!updateSubscriptionPlanDto.metadata.product_uid) {
          throw new BadRequestException('Metadata product_uid is required');
        }
      }

      // Validate prices if provided
      if (updateSubscriptionPlanDto.prices && updateSubscriptionPlanDto.prices.length > 0) {
        for (const price of updateSubscriptionPlanDto.prices) {
          if (!price.id || !price.interval) {
            throw new BadRequestException('Each price must have both id and interval');
          }
        }
      }

      return await this.subscriptionPlansService.update(
        subscription_plan_uid,
        updateSubscriptionPlanDto,
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ValidationError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error updating subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        `Failed to update subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @Delete(':subscription_plan_uid')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('subscription_plan_uid') subscription_plan_uid: string) {
    try {
      if (!subscription_plan_uid || subscription_plan_uid.trim() === '') {
        throw new BadRequestException('Subscription plan UID is required');
      }

      await this.subscriptionPlansService.remove(subscription_plan_uid);
      return { message: 'Subscription plan deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error deleting subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        `Failed to delete subscription plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
