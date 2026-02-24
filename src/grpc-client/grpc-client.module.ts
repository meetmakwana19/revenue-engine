// gRPC Client Module
// This module provides the gRPC client service to other parts of the application

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { getGrpcClientConfig } from './grpc-client.config';
import { GrpcPlanClientService } from './grpc-plan-client.service';
import { GrpcPlanController } from './grpc-plan.controller';

/**
 * gRPC Client Module
 *
 * This module:
 * 1. Registers the gRPC client configuration at the module level (infrastructure)
 * 2. Provides GrpcPlanClientService as a wrapper/adapter (abstraction layer)
 * 3. Exports the service so other modules can use it
 *
 * Architecture:
 * - Module Layer: Configures transport (gRPC client registration)
 * - Service Layer: Wraps client with domain-friendly interface
 * - Controller Layer: Uses service (already correct)
 */
@Module({
  imports: [
    // Register gRPC client configuration at module level
    ClientsModule.registerAsync([
      {
        name: 'PLAN_GRPC_CLIENT', // Injection token for the gRPC client
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: getGrpcClientConfig,
      },
    ]),
  ],
  controllers: [GrpcPlanController],
  providers: [GrpcPlanClientService],
  exports: [GrpcPlanClientService],
})
export class GrpcClientModule {}
