import { RABBITMQ_TOPOLOGY } from '../messaging.constants';

export const ORDER_READY_CONSUMER_TOPOLOGY = {
  exchange: RABBITMQ_TOPOLOGY.defaultExchange,

  queues: {
    main: 'wkms.order-ready.v1',
    retry: 'wkms.order-ready.retry.v1',
    deadLetter: 'wkms.order-ready.dlq.v1',
  },

  routingKeys: {
    orderReady: RABBITMQ_TOPOLOGY.routingKeys.orderReady,
    retry: 'wkms.order.ready.retry.v1',
    deadLetter: 'wkms.order.ready.dlq.v1',
  },

  maxRetries: 3,
  retryDelayMs: 60_000,
  reconnectDelayMs: 15_000,
  publisherConfirmTimeoutMs: 15_000,
  prefetch: 1,
} as const;

export const ORDER_READY_RETRY_HEADER = 'x-wkms-order-ready-retry-count';
