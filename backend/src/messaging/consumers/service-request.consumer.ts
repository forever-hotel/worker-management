import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  connect,
  type ChannelModel,
  type Channel,
  type ConfirmChannel,
  type ConsumeMessage,
} from 'amqplib';
import { FrontDeskTaskService } from '../../tasks/front-desk-task.service';

@Injectable()
export class ServiceRequestConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServiceRequestConsumer.name);
  private connection?: ChannelModel;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  constructor(
    private readonly config: ConfigService,
    private readonly service: FrontDeskTaskService,
  ) {}
  onModuleInit() {
    const enabled = this.config.get('RABBITMQ_ENABLED');
    if (enabled === true || enabled === 'true') void this.attach();
  }
  async attach() {
    try {
      const connection = await connect(
        this.config.getOrThrow<string>('RABBITMQ_URL'),
        { timeout: 5000 },
      );
      if (this.stopped) {
        await connection.close();
        return;
      }
      this.connection = connection;
      connection.on('error', () => undefined);
      connection.on('close', () => this.schedule());
      const channel = await connection.createChannel(),
        retry = await connection.createConfirmChannel();
      for (const c of [channel, retry]) {
        c.on('error', () => undefined);
        c.on('close', () => {
          void connection.close().catch(() => undefined);
        });
      }
      const exchange =
        this.config.get<string>('RABBITMQ_EXCHANGE') ?? 'forever.events';
      await channel.assertExchange(exchange, 'topic', { durable: true });
      await channel.assertQueue('wkms.service-request.dead', { durable: true });
      await channel.assertQueue('wkms.service-request.v1', {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': 'wkms.service-request.dead',
        },
      });
      await channel.bindQueue(
        'wkms.service-request.v1',
        exchange,
        'fds.service.requested.v1',
      );
      await channel.assertQueue('wkms.service-request.retry', {
        durable: true,
        arguments: {
          'x-message-ttl': 5000,
          'x-dead-letter-exchange': exchange,
          'x-dead-letter-routing-key': 'fds.service.requested.v1',
        },
      });
      await channel.prefetch(10);
      await channel.consume('wkms.service-request.v1', (message) => {
        if (!message) {
          void connection.close().catch(() => undefined);
          return;
        }
        void this.accept(message, channel, retry, connection).catch(() => {
          void connection.close().catch(() => undefined);
        });
      });
    } catch {
      await this.connection?.close().catch(() => undefined);
      this.schedule();
    }
  }
  async accept(
    message: ConsumeMessage,
    channel: Channel,
    retry: ConfirmChannel,
    connection: ChannelModel,
  ) {
    try {
      if (message.content.length > 8192) throw new BadRequestException();
      let event: {
        eventType?: string;
        eventVersion?: number;
        source?: string;
        eventId?: string;
        data?: { requestId?: string };
      };
      try {
        event = JSON.parse(message.content.toString());
      } catch {
        throw new BadRequestException();
      }
      if (
        !event ||
        event.eventType !== 'service.requested' ||
        event.eventVersion !== 1 ||
        event.source !== 'front-desk' ||
        event.eventId !== 'service-request:' + event.data?.requestId
      )
        throw new BadRequestException();
      await this.service.create(event.data?.requestId ?? '');
      channel.ack(message);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        channel.nack(message, false, false);
        return;
      }
      const raw = message.properties.headers?.['x-service-attempts'];
      const attempts =
        typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0;
      if (attempts >= 5) {
        channel.nack(message, false, false);
        return;
      }
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error('Retry publication timed out')),
            5000,
          );
          retry.sendToQueue(
            'wkms.service-request.retry',
            message.content,
            {
              persistent: true,
              contentType: 'application/json',
              headers: { 'x-service-attempts': attempts + 1 },
            },
            (err) => {
              clearTimeout(timeout);
              err ? reject(err) : resolve();
            },
          );
        });
        channel.ack(message);
      } catch {
        await connection.close().catch(() => undefined);
      }
    }
  }
  private schedule() {
    if (this.stopped || this.timer) return;
    this.logger.warn('Service request consumer reconnecting');
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.attach();
    }, 3000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.connection?.close().catch(() => undefined);
  }
}
