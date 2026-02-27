import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as microservices from '@nestjs/microservices';
import { firstValueFrom, Observable, timeout, TimeoutError } from 'rxjs';

// Interface matching the proto file definition
// These must match exactly what's defined in plan.proto

export interface PlanFeature {
  uid: string;
  name: string;
  enabled: boolean;
  limit?: number;
  max_limit?: number;
  is_custom?: boolean;
  group_key?: string;
  key_order?: number;
}

export interface PlanData {
  plan_id: string; // Required - identifies which plan to update
  name?: string; // All fields optional for PATCH-style updates except plan_id
  blockedAssetTypes?: string[];
  tags?: string[];
  price?: string;
  message?: string;
  features?: PlanFeature[]; // Optional - only update provided features
  tier_uid?: string;
  tier_name?: string;
}

export interface UpdatePlanRequest {
  plan: PlanData; // Required - plan_id must be inside plan object
}

export interface UpdatePlanResponse {
  success: boolean;
  message: string;
  plan?: PlanData; // Updated plan data (if successful)
  errors?: string[]; // Error messages (if failed)
}

export interface HandleOrganizationPlanLifecycleRequest {
  org_uid: string;
  org_plan_template_uid: string;
}

export interface HandleOrganizationPlanLifecycleResponse {
  success: boolean;
  message: string;
  plan_id?: string;
  org_uid?: string;
  errors?: string[];
}

// Interface for the PlanService client
// This represents the methods available on the gRPC service
interface PlanServiceClient {
  updatePlan(data: UpdatePlanRequest): Observable<UpdatePlanResponse>;
  handleOrganizationPlanLifecycle(
    data: HandleOrganizationPlanLifecycleRequest,
  ): Observable<HandleOrganizationPlanLifecycleResponse>;
}
@Injectable()
export class GrpcPlanClientService implements OnModuleInit {
  private readonly logger = new Logger(GrpcPlanClientService.name);

  // Reference to the PlanService (will be populated after connection)
  private planService: PlanServiceClient;

  /**
   * Constructor: Inject the configured gRPC client from the module
   * The client is configured in GrpcClientModule using ClientsModule.registerAsync()
   */
  constructor(@Inject('PLAN_GRPC_CLIENT') private readonly client: microservices.ClientGrpc) {}

  /**
   * Initialize the PlanService reference when the module starts
   * This happens after the gRPC client is fully configured and connected
   */
  onModuleInit() {
    this.logger.log('Initializing PlanService from gRPC client...');

    // Get the PlanService from the injected client
    // This gives us access to all methods defined in the proto file
    this.planService = this.client.getService<PlanServiceClient>('PlanService');

    if (!this.planService) {
      this.logger.error('Failed to get PlanService from gRPC client');
      throw new Error('Failed to initialize gRPC PlanService');
    }

    this.logger.log('✅ PlanService initialized successfully');
  }

  async updatePlan(request: UpdatePlanRequest): Promise<UpdatePlanResponse> {
    // Validate request structure
    if (!request || !request.plan) {
      const error = new Error('Invalid request: plan object is required');
      this.logger.error(`🟢 [gRPC CLIENT] ${error.message}`);
      throw error;
    }

    if (!request.plan.plan_id) {
      const error = new Error('Invalid request: plan.plan_id is required');
      this.logger.error(`🟢 [gRPC CLIENT] ${error.message}`);
      throw error;
    }

    const planId = request.plan.plan_id;
    this.logger.log(`🟢 [gRPC CLIENT] Calling gRPC updatePlan for plan_id: ${planId}`);
    this.logger.log(`🟢 [gRPC CLIENT] Request payload: ${JSON.stringify(request)}`);

    if (!this.planService) {
      const error = new Error('gRPC PlanService not initialized. Check if server is running.');
      this.logger.error(`🟢 [gRPC CLIENT] ${error.message}`);
      throw error;
    }

    try {
      this.logger.log(`🟢 [gRPC CLIENT] Making actual gRPC network call...`);

      // IMPORTANT: gRPC methods return Observables, not Promises
      // This wrapper converts Observable to Promise using firstValueFrom()
      // Add timeout to prevent hanging (30 seconds)
      const response = await firstValueFrom(
        this.planService.updatePlan(request).pipe(
          timeout(30000), // 30 second timeout
        ),
      );

      return response;
    } catch (error) {
      // Handle timeout specifically
      if (error instanceof TimeoutError) {
        const timeoutError = new Error(
          'gRPC call timed out after 30 seconds. The server may not be responding or proto files may be mismatched. Please restart both services.',
        );
        this.logger.error(`🟢 [gRPC CLIENT] ❌ ${timeoutError.message}`);
        throw timeoutError;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `🟢 [gRPC CLIENT] ❌ Error calling gRPC updatePlan: ${errorMessage}`,
        errorStack,
      );

      if (error instanceof Error) {
        this.logger.error(`🟢 [gRPC CLIENT] Error name: ${error.name}`);
        const errorWithCode = error as Error & { code?: string | number };
        if ('code' in errorWithCode && errorWithCode.code !== undefined) {
          this.logger.error(`🟢 [gRPC CLIENT] Error code: ${errorWithCode.code}`);
        }
      }

      throw error;
    }
  }

  async handleOrganizationPlanLifecycle(
    request: HandleOrganizationPlanLifecycleRequest,
  ): Promise<HandleOrganizationPlanLifecycleResponse> {
    // Validate request structure
    if (!request || !request.org_uid || !request.org_plan_template_uid) {
      const error = new Error('Invalid request: org_uid and org_plan_template_uid are required');
      this.logger.error(`🟢 [gRPC CLIENT] ${error.message}`);
      throw error;
    }

    this.logger.log(
      `🟢 [gRPC CLIENT] Calling gRPC handleOrganizationPlanLifecycle for org_uid: ${request.org_uid}, template_uid: ${request.org_plan_template_uid}`,
    );
    this.logger.log(`🟢 [gRPC CLIENT] Request payload: ${JSON.stringify(request)}`);

    if (!this.planService) {
      const error = new Error('gRPC PlanService not initialized. Check if server is running.');
      this.logger.error(`🟢 [gRPC CLIENT] ${error.message}`);
      throw error;
    }

    try {
      this.logger.log(`🟢 [gRPC CLIENT] Making actual gRPC network call...`);

      // IMPORTANT: gRPC methods return Observables, not Promises
      // This wrapper converts Observable to Promise using firstValueFrom()
      // Add timeout to prevent hanging (30 seconds)
      const response = await firstValueFrom(
        this.planService.handleOrganizationPlanLifecycle(request).pipe(
          timeout(30000), // 30 second timeout
        ),
      );

      return response;
    } catch (error) {
      // Handle timeout specifically
      if (error instanceof TimeoutError) {
        const timeoutError = new Error(
          'gRPC call timed out after 30 seconds. The server may not be responding or proto files may be mismatched. Please restart both services.',
        );
        this.logger.error(`🟢 [gRPC CLIENT] ❌ ${timeoutError.message}`);
        throw timeoutError;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `🟢 [gRPC CLIENT] ❌ Error calling gRPC handleOrganizationPlanLifecycle: ${errorMessage}`,
        errorStack,
      );

      if (error instanceof Error) {
        this.logger.error(`🟢 [gRPC CLIENT] Error name: ${error.name}`);
        const errorWithCode = error as Error & { code?: string | number };
        if ('code' in errorWithCode && errorWithCode.code !== undefined) {
          this.logger.error(`🟢 [gRPC CLIENT] Error code: ${errorWithCode.code}`);
        }
      }

      throw error;
    }
  }

  healthCheck(): boolean {
    try {
      // Try a simple call to verify connection
      // In a real app, you might have a dedicated health check method
      this.logger.log('Performing gRPC health check...');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`gRPC health check failed: ${errorMessage}`);
      return false;
    }
  }
}
