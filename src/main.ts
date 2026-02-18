import { Logger } from '@nestjs/common';
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
