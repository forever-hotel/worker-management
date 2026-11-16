import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { connect } from 'amqplib';
import type {
  Channel,
  ChannelModel,
  ConfirmChannel,
  ConsumeMessage,
} from 'amqplib';
import { OrderReadyEventValidationError } from '../contracts/order-ready.validator';
import { OrderReadyHandler } from '../handlers/order-ready.handler';
import {
  RABBITMQ_CONFIG,
  type RabbitMqRuntimeConfig,
} from '../rabbitmq/rabbitmq.config';
import {
  ORDER_READY_CONSUMER_TOPOLOGY as TOPOLOGY,
  ORDER_READY_RETRY_HEADER,
} from './order-ready.consumer.topology';

@Injectable()
export class OrderReadyConsumer implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OrderReadyConsumer.name);

  private connection: ChannelModel | null = null;
  private consumerChannel: Channel | null = null;
  private retryChannel: ConfirmChannel | null = null;
  private connectionPromise: Promise<void> | null = null;
  private shuttingDown = false;

  constructor(
    @Inject(RABBITMQ_CONFIG)
    private readonly config: RabbitMqRuntimeConfig,
    private readonly handler: OrderReadyHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.log('Order-ready event consumer disabled');
      return;
    }

    try {
      await this.ensureConnected();
    } catch {
      this.logger.warn(
        'Order-ready consumer unavailable at startup; reconnection scheduled',
      );
    }
  }

  @Interval(TOPOLOGY.reconnectDelayMs)
  async reconnectIfNeeded(): Promise<void> {
    if (
      this.shuttingDown ||
      !this.config.enabled ||
      this.connection !== null ||
      this.connectionPromise !== null
    ) {
      return;
    }

    try {
      await this.ensureConnected();
    } catch {
      this.logger.warn('Order-ready consumer reconnect attempt failed');
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.shuttingDown || this.connection) {
      return;
    }

    if (this.connectionPromise) {
      await this.connectionPromise;
      return;
    }

    this.connectionPromise = this.connectAndSubscribe();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async connectAndSubscribe(): Promise<void> {
    if (!this.config.url) {
      throw new Error('RabbitMQ consumer URL is missing');
    }

    const connection = await connect(this.config.url, {
      timeout: 10_000,
    });

    connection.on('error', () => {
      this.logger.warn('Order-ready consumer RabbitMQ connection error');
    });

    connection.on('close', () => {
      if (this.connection === connection) {
        this.connection = null;
        this.consumerChannel = null;
        this.retryChannel = null;
      }

      if (!this.shuttingDown) {
        this.logger.warn('Order-ready consumer connection closed');
      }
    });

    try {
      const consumerChannel = await connection.createChannel();
      const retryChannel = await connection.createConfirmChannel();

      consumerChannel.on('error', () => {
        this.logger.warn('Order-ready consumer channel error');
      });

      retryChannel.on('error', () => {
        this.logger.warn('Order-ready retry publisher channel error');
      });

      const reconnectOnClose = (): void => {
        if (this.connection === connection && !this.shuttingDown) {
          void connection.close().catch(() => undefined);
        }
      };

      consumerChannel.on('close', reconnectOnClose);
      retryChannel.on('close', reconnectOnClose);

      await this.assertTopology(consumerChannel);
      await consumerChannel.prefetch(TOPOLOGY.prefetch);

      if (this.shuttingDown) {
        await connection.close();
        return;
      }

      this.connection = connection;
      this.consumerChannel = consumerChannel;
      this.retryChannel = retryChannel;

      await consumerChannel.consume(
        TOPOLOGY.queues.main,
        (message) => {
          if (message === null) {
            return;
          }

          void this.processMessage(
            message,
            consumerChannel,
            retryChannel,
            connection,
          ).catch(() => {
            this.logger.warn(
              'Order-ready message interrupted; broker redelivery expected',
            );
          });
        },
        { noAck: false },
      );

      this.logger.log('Order-ready consumer connected and subscribed');
    } catch (error) {
      if (this.connection === connection) {
        this.connection = null;
        this.consumerChannel = null;
        this.retryChannel = null;
      }

      await connection.close().catch(() => undefined);
      throw error;
    }
  }

  async assertTopology(channel: Channel): Promise<void> {
    await channel.assertExchange(this.config.exchange, 'topic', {
      durable: true,
    });

    // Declare the dead-letter destination first.
    await channel.assertQueue(TOPOLOGY.queues.deadLetter, {
      durable: true,
    });

    await channel.bindQueue(
      TOPOLOGY.queues.deadLetter,
      this.config.exchange,
      TOPOLOGY.routingKeys.deadLetter,
    );

    await channel.assertQueue(TOPOLOGY.queues.main, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.config.exchange,
        'x-dead-letter-routing-key': TOPOLOGY.routingKeys.deadLetter,
      },
    });

    await channel.bindQueue(
      TOPOLOGY.queues.main,
      this.config.exchange,
      TOPOLOGY.routingKeys.orderReady,
    );

    // Expired retry messages are routed back to the main queue.
    await channel.assertQueue(TOPOLOGY.queues.retry, {
      durable: true,
      arguments: {
        'x-message-ttl': TOPOLOGY.retryDelayMs,
        'x-dead-letter-exchange': this.config.exchange,
        'x-dead-letter-routing-key': TOPOLOGY.routingKeys.orderReady,
      },
    });

    await channel.bindQueue(
      TOPOLOGY.queues.retry,
      this.config.exchange,
      TOPOLOGY.routingKeys.retry,
    );
  }

  async processMessage(
    message: ConsumeMessage,
    consumerChannel: Channel,
    retryChannel: ConfirmChannel,
    connection: ChannelModel,
  ): Promise<void> {
    try {
      const payload: unknown = JSON.parse(message.content.toString('utf8'));

      await this.handler.handle(payload);

      // ACK only after durable task creation or confirmed duplicate.
      consumerChannel.ack(message);
      return;
    } catch (error) {
      if (this.isPermanentFailure(error)) {
        this.logger.warn(
          'Invalid or conflicting order-ready event sent to dead-letter queue',
        );
        consumerChannel.nack(message, false, false);
        return;
      }

      const previousAttempts = this.readRetryCount(message);

      if (previousAttempts >= TOPOLOGY.maxRetries) {
        this.logger.warn(
          'Order-ready event retry limit reached; dead-lettering',
        );
        consumerChannel.nack(message, false, false);
        return;
      }

      try {
        await this.publishRetry(message, retryChannel, previousAttempts + 1);

        // Never ACK before RabbitMQ confirms the retry publication.
        consumerChannel.ack(message);
      } catch {
        this.logger.warn(
          'Order-ready retry publication failed; closing connection for redelivery',
        );

        // Leave the original message unacknowledged.
        // RabbitMQ will redeliver it after connection recovery.
        await connection.close().catch(() => undefined);
      }
    }
  }

  private isPermanentFailure(error: unknown): boolean {
    if (
      error instanceof SyntaxError ||
      error instanceof OrderReadyEventValidationError
    ) {
      return true;
    }

    return (
      error instanceof Error &&
      error.message === 'FOOD_DELIVERY_TASK_ROOM_CONFLICT'
    );
  }

  private readRetryCount(message: ConsumeMessage): number {
    const value = message.properties.headers?.[ORDER_READY_RETRY_HEADER];

    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      return 0;
    }

    return value;
  }

  private async publishRetry(
    message: ConsumeMessage,
    channel: ConfirmChannel,
    retryCount: number,
  ): Promise<void> {
    const messageId =
      message.properties.messageId ?? `wkms-order-ready-retry-${Date.now()}`;

    let returned = false;

    const onReturn = (returnedMessage: ConsumeMessage): void => {
      if (returnedMessage.properties.messageId === messageId) {
        returned = true;
      }
    };

    channel.on('return', onReturn);

    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      channel.publish(
        this.config.exchange,
        TOPOLOGY.routingKeys.retry,
        message.content,
        {
          persistent: true,
          mandatory: true,
          contentType: 'application/json',
          contentEncoding: 'utf-8',
          messageId,
          headers: {
            ...message.properties.headers,
            [ORDER_READY_RETRY_HEADER]: retryCount,
          },
        },
      );

      await Promise.race([
        channel.waitForConfirms(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error('Order-ready retry confirmation timed out'));
          }, TOPOLOGY.publisherConfirmTimeoutMs);
        }),
      ]);

      if (returned) {
        throw new Error('Order-ready retry message was unroutable');
      }
    } finally {
      channel.off('return', onReturn);

      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;

    await this.connectionPromise?.catch(() => undefined);

    const consumerChannel = this.consumerChannel;
    const retryChannel = this.retryChannel;
    const connection = this.connection;

    this.consumerChannel = null;
    this.retryChannel = null;
    this.connection = null;

    await consumerChannel?.close().catch(() => undefined);
    await retryChannel?.close().catch(() => undefined);
    await connection?.close().catch(() => undefined);
  }
}
