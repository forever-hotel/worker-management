import { ConfigService } from '@nestjs/config';
import { createRabbitMqConfig } from './rabbitmq.config';

describe('RabbitMQ configuration', () => {
  function config(values: Record<string, string | undefined>): ConfigService {
    return {
      get: (key: string) => values[key],
    } as unknown as ConfigService;
  }

  it('defaults to disabled messaging', () => {
    expect(createRabbitMqConfig(config({}))).toEqual({
      enabled: false,
      url: null,
      exchange: 'forever.events',
    });
  });

  it('treats the string false as disabled', () => {
    const result = createRabbitMqConfig(
      config({
        RABBITMQ_ENABLED: 'false',
      }),
    );

    expect(result.enabled).toBe(false);
  });

  it('enables RabbitMQ with a configured URL', () => {
    const result = createRabbitMqConfig(
      config({
        RABBITMQ_ENABLED: 'true',
        RABBITMQ_URL: 'amqp://localhost:5672',
      }),
    );

    expect(result.enabled).toBe(true);
    expect(result.url).toBe('amqp://localhost:5672');
  });

  it('rejects enabling RabbitMQ without a URL', () => {
    expect(() =>
      createRabbitMqConfig(
        config({
          RABBITMQ_ENABLED: 'true',
        }),
      ),
    ).toThrow('RABBITMQ_URL is required');
  });

  it('rejects invalid enabled values', () => {
    expect(() =>
      createRabbitMqConfig(
        config({
          RABBITMQ_ENABLED: 'yes',
        }),
      ),
    ).toThrow('RABBITMQ_ENABLED must be true or false');
  });

  it('supports the configured exchange', () => {
    const result = createRabbitMqConfig(
      config({
        RABBITMQ_EXCHANGE: 'hotel.test.events',
      }),
    );

    expect(result.exchange).toBe('hotel.test.events');
  });
});
