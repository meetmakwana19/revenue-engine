import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { GrpcPlanClientService, type UpdatePlanRequest } from './grpc-plan-client.service';

@Controller('grpc-example')
export class GrpcPlanController {
  private readonly logger = new Logger(GrpcPlanController.name);

  constructor(private readonly grpcPlanClient: GrpcPlanClientService) {}

  @Post('update-plan')
  async updatePlan(@Body() request: UpdatePlanRequest) {
    this.logger.log(`Received HTTP request to update plan via gRPC: ${request.plan_id}`);

    try {
      // Call the gRPC client service which will make a gRPC call to the gRPC server
      const response = await this.grpcPlanClient.updatePlan(request);

      return {
        success: true,
        message: 'Plan updated successfully via gRPC',
        data: response,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update plan via gRPC: ${errorMessage}`);

      return {
        success: false,
        message: `Failed to update plan: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  @Get('health')
  healthCheck() {
    const isHealthy = this.grpcPlanClient.healthCheck();

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'gRPC Client',
      timestamp: new Date().toISOString(),
    };
  }
}
