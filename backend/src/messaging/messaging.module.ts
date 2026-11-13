import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CheckoutCompletedConsumer } from './consumers/checkout-completed.consumer';
import { CheckoutCompletedHandler } from './handlers/checkout-completed.handler';
import { OutboxDispatcherService } from './outbox/outbox-dispatcher.service';
import { TaskEscalatedPublisher } from './publishers/task-escalated.publisher';

import { RabbitMqModule } from './rabbitmq/rabbitmq.module';

import { OrderReadyHandler } from './handlers/order-ready.handler';
import { OrderReadyConsumer } from './consumers/order-ready.consumer';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [ConfigModule, RealtimeModule, RabbitMqModule],
  providers: [
    TaskEscalatedPublisher,
    OutboxDispatcherService,

    // FDS checkout-completed consumer
    CheckoutCompletedHandler,
    CheckoutCompletedConsumer,

    // KMS order-ready consumer
    OrderReadyHandler,
    OrderReadyConsumer,
  ],
  exports: [RabbitMqModule, TaskEscalatedPublisher],
})
export class MessagingModule {}
