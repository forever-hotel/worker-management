import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { PoolClient, QueryResultRow } from 'pg';

import { DatabaseService } from '../../database/database.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

interface PendingOutboxEvent extends QueryResultRow {
  event_id: string;
  routing_key: string;
  payload: unknown;
}

type DispatchResult = 'EMPTY' | 'PUBLISHED' | 'FAILED';

@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);

  private readonly batchSize = 100;
  private dispatching = false;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly rabbitMqService: RabbitMqService,
  ) {}

  @Interval(250)
  async dispatchPendingEvents(): Promise<void> {
    if (!this.rabbitMqService.isEnabled()) {
      return;
    }

    if (this.dispatching) {
      return;
    }

    this.dispatching = true;

    try {
      for (let i = 0; i < this.batchSize; i++) {
        const result = await this.databaseService.withTransaction(
          async (client) => this.dispatchNext(client),
        );

        if (result === 'EMPTY') {
          break;
        }

        if (result === 'FAILED') {
          this.logger.warn(
            'Outbox publication failed; event remains pending for retry',
          );
        }
      }
    } catch {
      this.logger.error(
        'Outbox dispatch failed; pending events will be retried',
      );
    } finally {
      this.dispatching = false;
    }
  }

  private async dispatchNext(client: PoolClient): Promise<DispatchResult> {
    const result = await client.query<PendingOutboxEvent>(
      `SELECT event_id, routing_key, payload
       FROM wkms_event_outbox
       WHERE status = 'PENDING'
         AND (
           last_attempt_at IS NULL
           OR last_attempt_at <= NOW() - LEAST(60, power(2, LEAST(attempt_count, 6))) * INTERVAL '1 second'
         )
       ORDER BY created_at, event_id
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
    );

    const event = result.rows[0];

    if (!event) {
      return 'EMPTY';
    }

    try {
      if (event.routing_key === 'task.changed') {
        await this.rabbitMqService.publishJson(
          event.routing_key,
          event.payload,
          event.event_id,
          'hotel.events',
        );
      } else {
        await this.rabbitMqService.publishJson(
          event.routing_key,
          event.payload,
          event.event_id,
        );
      }
    } catch {
      await client.query(
        `UPDATE wkms_event_outbox
         SET attempt_count = attempt_count + 1,
             last_attempt_at = NOW(),
             last_error = 'RabbitMQ publication failed'
         WHERE event_id = $1`,
        [event.event_id],
      );

      return 'FAILED';
    }

    await client.query(
      `UPDATE wkms_event_outbox
       SET status = 'PUBLISHED',
           published_at = NOW(),
           attempt_count = attempt_count + 1,
           last_attempt_at = NOW(),
           last_error = NULL
       WHERE event_id = $1`,
      [event.event_id],
    );

    return 'PUBLISHED';
  }
}
