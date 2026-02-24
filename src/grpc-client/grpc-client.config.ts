import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

/**
 * gRPC Client Configuration Factory
 *
 * This factory function creates the configuration for the gRPC client.
 * It's extracted from the module to:
 * 1. Follow NestJS best practices (configuration separate from module)
 * 2. Improve testability (can test config logic independently)
 * 3. Match codebase patterns (similar to mongoose.config.ts)
 * 4. Enable reuse across different modules if needed
 *
 * @param configService - NestJS ConfigService for accessing environment variables
 * @returns gRPC client configuration object
 */
export function getGrpcClientConfig(configService: ConfigService): GrpcOptions {
  const logger = new Logger('GrpcClientConfig');

  // Determine proto file path based on environment
  // When running in dev mode with NestJS, code runs from dist/grpc-client/ after compilation
  // Proto files are copied to dist/proto/ during build via nest-cli.json assets configuration
  // Proto file is located at src/proto/plan.proto in source, and dist/proto/plan.proto when compiled
  const protoPath = join(__dirname, '../proto/plan.proto'); // From dist/grpc-client/ or src/grpc-client/, go up one level, then proto/

  // Use 127.0.0.1 to avoid IPv6 (::1) resolution when server binds to 0.0.0.0 (IPv4)
  const serverUrl = configService.get<string>('GRPC_SERVER_URL') || '127.0.0.1:5000';

  logger.log(`gRPC Client Configuration:`);
  logger.log(`  Proto path: ${protoPath}`);
  logger.log(`  Server URL: ${serverUrl}`);
  logger.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);

  return {
    transport: Transport.GRPC,
    options: {
      // Array of proto file paths (must match server!)
      protoPath: [protoPath],
      // Array of package names from proto files (must match server!)
      // package[0] corresponds to protoPath[0]
      package: ['plan'],
      // URL of the gRPC server (superadmin-api)
      url: serverUrl,
      // Preserve snake_case from proto so plan_id is serialized correctly (must match server loader)
      loader: {
        keepCase: true,
      },
    },
  };
}
