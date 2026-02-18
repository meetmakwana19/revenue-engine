import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log('Starting Revenue Engine application...');

    const app = await NestFactory.create(AppModule, {
      rawBody: true, // Enable raw body for webhook signature verification
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    // Enable global validation pipe for automatic DTO validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true, // Strip properties that don't have decorators
        forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
        transform: true, // Automatically transform payloads to DTO instances
        transformOptions: {
          enableImplicitConversion: true, // Enable implicit type conversion
        },
      }),
    );

    const port = process.env.PORT ?? 3000;
    await app.listen(port);

    logger.log(`Application is running on port ${port}`);
    logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.log('MongoDB connection status will be logged by MongooseModule');
  } catch (error) {
    logger.error('Error during application bootstrap:', error);
    if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
    }
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('Fatal error during application bootstrap:', err);
  process.exit(1);
});
