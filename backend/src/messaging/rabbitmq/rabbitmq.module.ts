import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createRabbitMqConfig, RABBITMQ_CONFIG } from './rabbitmq.config';
import { RabbitMqService } from './rabbitmq.service';
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RABBITMQ_CONFIG,
      inject: [ConfigService],
      useFactory: createRabbitMqConfig,
    },
    RabbitMqService,
  ],
  exports: [RABBITMQ_CONFIG, RabbitMqService],
})
export class RabbitMqModule {}
