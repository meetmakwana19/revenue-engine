import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';

export function getMongooseConfig(configService: ConfigService) {
  const logger = new Logger('MongooseConfig');

  const uri = configService.get<string>('MONGODB_URI');

  const isDev = configService.get('NODE_ENV') !== 'production';

  mongoose.set('debug', isDev);
  return {
    uri,
    onConnectionCreate: (connection: mongoose.Connection) => {
      const dbName = connection.db?.databaseName;
      const host = connection.host;
      const port = connection.port;

      // If already connected (fast local case)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (connection.readyState === 1) {
        logger.log('MongoDB already connected');
        logger.log(`Database: ${dbName}`);
        logger.log(`Host: ${host}:${port}`);
      }

      connection.on('connected', () => {
        logger.log('MongoDB connected');
        logger.log(`Database: ${connection.db?.databaseName}`);
        logger.log(`Host: ${connection.host}:${connection.port}`);
      });

      connection.on('error', (err: Error) => {
        logger.error('MongoDB error:', err.message);
      });

      connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

      return connection;
    },
  };
}
