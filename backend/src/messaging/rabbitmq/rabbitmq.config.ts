import { ConfigService } from '@nestjs/config';
import { RABBITMQ_TOPOLOGY } from '../messaging.constants';

export const RABBITMQ_CONFIG = Symbol('RABBITMQ_CONFIG');

export interface RabbitMqRuntimeConfig {
  enabled: boolean;
  url: string | null;
  exchange: string;
}

export function createRabbitMqConfig(
  configService: ConfigService,
): RabbitMqRuntimeConfig {
  const rawEnabled = configService.get<string | boolean>('RABBITMQ_ENABLED');

  if (
    rawEnabled !== undefined &&
    rawEnabled !== true &&
    rawEnabled !== false &&
    rawEnabled !== 'true' &&
    rawEnabled !== 'false'
  ) {
    throw new Error('RABBITMQ_ENABLED must be true or false');
  }

  const enabled = rawEnabled === true || rawEnabled === 'true';

  const url = configService.get<string>('RABBITMQ_URL')?.trim() || null;

  if (enabled && !url) {
    throw new Error('RABBITMQ_URL is required when RabbitMQ is enabled');
  }

  const exchange =
    configService.get<string>('RABBITMQ_EXCHANGE')?.trim() ||
    RABBITMQ_TOPOLOGY.defaultExchange;

  return {
    enabled,
    url,
    exchange,
  };
}
