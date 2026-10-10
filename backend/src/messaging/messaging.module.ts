import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { OutboxDispatcherService } from './outbox/outbox-dispatcher.service';
import { TaskEscalatedPublisher } from './publishers/task-escalated.publisher';

import {
  createRabbitMqConfig,
  RABBITMQ_CONFIG,
} from './rabbitmq/rabbitmq.config';

import { RabbitMqService } from './rabbitmq/rabbitmq.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RABBITMQ_CONFIG,
      inject: [ConfigService],
      useFactory: createRabbitMqConfig,
    },
    RabbitMqService,
    TaskEscalatedPublisher,
    OutboxDispatcherService,
  ],
  exports: [RabbitMqService, TaskEscalatedPublisher],
})
export class MessagingModule {}
