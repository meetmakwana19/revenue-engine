import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getMongooseConfig } from './config/mongoose.config';
import { GrpcClientModule } from './grpc-client/grpc-client.module';
import { PaymentModule } from './payment/payment.module';
import { SubscriptionPlansModule } from './subscription-plans/subscription-plans.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    // ConfigModule.forRoot returns Promise<DynamicModule> which NestJS handles automatically
    ConfigModule.forRoot({
      isGlobal: true,
    }) as any,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getMongooseConfig,
      inject: [ConfigService],
    }),
    PaymentModule,
    SubscriptionPlansModule,
    WebhookModule,
    GrpcClientModule, // gRPC client module for learning
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
