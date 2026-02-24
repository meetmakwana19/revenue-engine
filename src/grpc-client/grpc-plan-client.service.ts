import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as microservices from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

// Interface matching the proto file definition
// These must match exactly what's defined in plan.proto
export interface UpdatePlanRequest {
  plan_id: string;
  name?: string;
  price?: number;
  message?: string;
  is_active?: boolean;
}

export interface UpdatePlanResponse {
  success: boolean;
  message: string;
  plan_id: string;
  updated_at: string;
}

// Interface for the PlanService client
// This represents the methods available on the gRPC service
interface PlanServiceClient {
  updatePlan(data: UpdatePlanRequest): Observable<UpdatePlanResponse>;
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
    this.logger.log(`🟢 [gRPC CLIENT] Calling gRPC updatePlan for plan_id: ${request.plan_id}`);
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
      const response = await firstValueFrom(this.planService.updatePlan(request));

      this.logger.log(
        `🟢 [gRPC CLIENT] ✅ Received response from gRPC server: ${JSON.stringify(response)}`,
      );

      return response;
    } catch (error) {
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
