import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { connect } from 'amqplib';
import type { ChannelModel, ConfirmChannel } from 'amqplib';

import { RABBITMQ_CONFIG, type RabbitMqRuntimeConfig } from './rabbitmq.config';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqService.name);

  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connectionPromise: Promise<void> | null = null;
  private shuttingDown = false;

  constructor(
    @Inject(RABBITMQ_CONFIG)
    private readonly config: RabbitMqRuntimeConfig,
  ) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log('RabbitMQ messaging is disabled');
      return;
    }

    try {
      await this.ensureConnected();
    } catch {
      this.logger.warn(
        'RabbitMQ unavailable at startup; pending outbox events will be retried',
      );
    }
  }

  async publishJson(
    routingKey: string,
    payload: unknown,
    messageId?: string,
  ): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('RabbitMQ publishing is disabled');
    }

    await this.ensureConnected();

    const channel = this.channel;
    const connection = this.connection;

    if (!channel || !connection) {
      throw new Error('RabbitMQ publisher channel unavailable');
    }

    const body = Buffer.from(JSON.stringify(payload), 'utf8');

    const publishMessageId = messageId ?? randomUUID();

    let wasReturned = false;

    const onReturned = (returned: {
      properties: { messageId?: string };
    }): void => {
      if (returned.properties.messageId === publishMessageId) {
        wasReturned = true;
      }
    };

    channel.on('return', onReturned);

    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      channel.publish(this.config.exchange, routingKey, body, {
        mandatory: true,
        persistent: true,
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        messageId: publishMessageId,
      });

      await Promise.race([
        channel.waitForConfirms(),

        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error('RabbitMQ publisher confirmation timed out'));
          }, 15_000);
        }),
      ]);

      if (wasReturned) {
        throw new Error('RabbitMQ message was returned as unroutable');
      }
    } catch (error) {
      // Discard the connection after an uncertain publish result.
      // The outbox will retry using a fresh connection.
      if (this.connection === connection) {
        this.connection = null;
        this.channel = null;
      }

      void connection.close().catch(() => undefined);

      throw error;
    } finally {
      channel.off('return', onReturned);

      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.connection && this.channel) {
      return;
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
      return;
    }

    this.connectionPromise = this.connectAndInitialize();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async connectAndInitialize(): Promise<void> {
    if (!this.config.url) {
      throw new Error('RabbitMQ connection URL is missing');
    }

    const connection = await connect(this.config.url, {
      timeout: 10_000,
    });

    connection.on('error', () => {
      this.logger.error('RabbitMQ connection error');
    });

    connection.on('close', () => {
      if (this.connection === connection) {
        this.connection = null;
        this.channel = null;
      }

      if (!this.shuttingDown) {
        this.logger.warn('RabbitMQ connection closed');
      }
    });

    try {
      const channel = await connection.createConfirmChannel();

      channel.on('error', () => {
        this.logger.error('RabbitMQ publisher channel error');
      });

      channel.on('close', () => {
        if (this.channel === channel) {
          this.channel = null;
        }
      });

      await channel.assertExchange(this.config.exchange, 'topic', {
        durable: true,
      });

      this.connection = connection;
      this.channel = channel;

      this.logger.log('RabbitMQ publisher connected');
    } catch (error) {
      await connection.close().catch(() => undefined);
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;

    const channel = this.channel;
    const connection = this.connection;

    this.channel = null;
    this.connection = null;

    if (channel) {
      await channel.close().catch(() => {
        this.logger.warn('RabbitMQ channel shutdown failed');
      });
    }

    if (connection) {
      await connection.close().catch(() => {
        this.logger.warn('RabbitMQ connection shutdown failed');
      });
    }
  }
}
