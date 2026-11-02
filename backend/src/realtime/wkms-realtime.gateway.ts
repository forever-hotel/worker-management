import { Injectable, Logger } from '@nestjs/common';
import { RabbitMqService } from '../messaging/rabbitmq/rabbitmq.service';

// Business event adapter. Browser sockets are owned by the shared WebSocket service.
@Injectable()
export class WkmsRealtimeGateway {
  private readonly logger = new Logger(WkmsRealtimeGateway.name);
  constructor(private readonly broker: RabbitMqService) {}
  private publish(name: string): void {
    void this.broker.publishRealtime('wkms', name).catch(() => {
      this.logger.warn(
        'Realtime invalidation unavailable; clients recover through REST snapshots.',
      );
    });
  }
  emitTaskCreated(_taskId: string): void {
    this.publish('task.created');
  }
  emitTaskClaimed(_taskId: string): void {
    this.publish('task.claimed');
  }
  emitTaskEscalated(_taskId: string): void {
    this.publish('task.escalated');
  }
  emitTaskUpdated(_taskId: string): void {
    this.publish('task.updated');
  }
  emitTaskCompleted(_taskId: string): void {
    this.publish('task.completed');
  }
}
