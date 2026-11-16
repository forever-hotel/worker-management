import { RABBITMQ_TOPOLOGY } from '../messaging.constants';

export const CHECKOUT_CONSUMER_TOPOLOGY = {
  exchange: RABBITMQ_TOPOLOGY.defaultExchange,

  queues: {
    main: 'wkms.checkout-completed.v1',
    retry: 'wkms.checkout-completed.retry.v1',
    deadLetter: 'wkms.checkout-completed.dlq.v1',
  },

  routingKeys: {
    checkoutCompleted: RABBITMQ_TOPOLOGY.routingKeys.checkoutCompleted,
    retry: 'wkms.checkout.completed.retry.v1',
    deadLetter: 'wkms.checkout.completed.dlq.v1',
  },

  maxRetries: 3,
  retryDelayMs: 60_000,
  reconnectDelayMs: 15_000,
  publisherConfirmTimeoutMs: 15_000,
  prefetch: 1,
} as const;

export const CHECKOUT_RETRY_HEADER = 'x-wkms-checkout-retry-count';
