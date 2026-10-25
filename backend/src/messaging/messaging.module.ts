import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CheckoutCompletedConsumer } from './consumers/checkout-completed.consumer';
import { CheckoutCompletedHandler } from './handlers/checkout-completed.handler';
import { OutboxDispatcherService } from './outbox/outbox-dispatcher.service';
import { TaskEscalatedPublisher } from './publishers/task-escalated.publisher';

import {
  createRabbitMqConfig,
  RABBITMQ_CONFIG,
} from './rabbitmq/rabbitmq.config';

import { RabbitMqService } from './rabbitmq/rabbitmq.service';
import { OrderReadyHandler } from './handlers/order-ready.handler';
import { OrderReadyConsumer } from './consumers/order-ready.consumer';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [ConfigModule, RealtimeModule],
  providers: [
    {
      provide: RABBITMQ_CONFIG,
      inject: [ConfigService],
      useFactory: createRabbitMqConfig,
    },

    // Existing RabbitMQ publisher and escalation infrastructure
    RabbitMqService,
    TaskEscalatedPublisher,
    OutboxDispatcherService,

    // FDS checkout-completed consumer
    CheckoutCompletedHandler,
    CheckoutCompletedConsumer,

    // KMS order-ready consumer
    OrderReadyHandler,
    OrderReadyConsumer,
  ],
  exports: [RabbitMqService, TaskEscalatedPublisher],
})
export class MessagingModule {}
