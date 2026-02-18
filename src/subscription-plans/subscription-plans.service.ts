import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Error as MongooseError } from 'mongoose';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { SubscriptionPlan, SubscriptionPlanDocument } from './schemas/subscription-plan.schema';
import { generateSubscriptionPlanUid } from './utils/generate-uid.util';

// Custom error classes for domain errors
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

@Injectable()
export class SubscriptionPlansService {
  private readonly logger = new Logger(SubscriptionPlansService.name);

  constructor(
    @InjectModel(SubscriptionPlan.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
  ) {}

  private handleMongoError(error: unknown, context: string): never {
    this.logger.error(`${context}: ${error instanceof Error ? error.message : 'Unknown error'}`);

    if (error instanceof MongooseError.ValidationError) {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(', ');
      throw new ValidationError(`Validation error: ${messages}`);
    }

    // Handle duplicate key error (E11000)
    if (error instanceof Error && 'code' in error && error.code === 11000) {
      const errorWithKeyValue = error as Error & {
        keyValue?: Record<string, unknown>;
      };
      const keyValue: Record<string, unknown> = errorWithKeyValue.keyValue || {};
      const duplicateField = Object.keys(keyValue)[0];
      const duplicateValue = duplicateField ? String(keyValue[duplicateField]) : 'unknown';
      throw new ConflictError(
        `Subscription plan with ${duplicateField} '${duplicateValue}' already exists`,
      );
    }

    // Handle CastError (invalid ObjectId or type mismatch)
    if (error instanceof MongooseError.CastError) {
      throw new ValidationError(`Invalid ${error.path}: ${error.message}`);
    }

    // Re-throw known domain errors
    if (
      error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof ConflictError
    ) {
      throw error;
    }

    // Generic database error - rethrow as regular Error
    throw new Error(
      `Database error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  async create(createSubscriptionPlanDto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    try {
      // Generate system UID
      const subscription_plan_uid = generateSubscriptionPlanUid();

      const subscriptionPlan = new this.subscriptionPlanModel({
        ...createSubscriptionPlanDto,
        subscription_plan_uid,
        created_at: new Date(),
        updated_at: new Date(),
      });

      return await subscriptionPlan.save();
    } catch (error) {
      this.handleMongoError(error, 'Failed to create subscription plan');
    }
  }

  async findAll(limit?: number, skip?: number): Promise<SubscriptionPlan[]> {
    try {
      const query = this.subscriptionPlanModel.find();
      if (skip !== undefined) {
        query.skip(skip);
      }
      if (limit !== undefined) {
        query.limit(limit);
      }
      return await query.exec();
    } catch (error) {
      this.handleMongoError(error, 'Failed to fetch subscription plans');
    }
  }

  async findOne(subscription_plan_uid: string): Promise<SubscriptionPlan | null> {
    try {
      const subscriptionPlan = await this.subscriptionPlanModel
        .findOne({ subscription_plan_uid })
        .exec();

      if (!subscriptionPlan) {
        throw new NotFoundError(`Subscription plan with UID '${subscription_plan_uid}' not found`);
      }

      return subscriptionPlan;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      this.handleMongoError(error, 'Failed to find subscription plan');
    }
  }

  async update(
    subscription_plan_uid: string,
    updateSubscriptionPlanDto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    try {
      const updatedPlan = await this.subscriptionPlanModel
        .findOneAndUpdate(
          { subscription_plan_uid },
          {
            ...updateSubscriptionPlanDto,
            updated_at: new Date(),
          },
          { new: true, runValidators: true },
        )
        .exec();

      if (!updatedPlan) {
        throw new NotFoundError(`Subscription plan with UID '${subscription_plan_uid}' not found`);
      }

      return updatedPlan;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      this.handleMongoError(error, 'Failed to update subscription plan');
    }
  }

  async remove(subscription_plan_uid: string): Promise<void> {
    try {
      const result = await this.subscriptionPlanModel
        .findOneAndDelete({ subscription_plan_uid })
        .exec();

      if (!result) {
        throw new NotFoundError(`Subscription plan with UID '${subscription_plan_uid}' not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      this.handleMongoError(error, 'Failed to delete subscription plan');
    }
  }
}
