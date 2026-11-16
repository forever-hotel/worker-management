export const RABBITMQ_TOPOLOGY = {
  defaultExchange: 'forever.events',

  routingKeys: {
    taskEscalated: 'wkms.task.escalated.v1',
    taskCompleted: 'wkms.task.completed.v1',
    checkoutCompleted: 'fds.checkout.completed.v1',
    orderReady: 'kms.order.ready.v1',
  },
} as const;

export const MESSAGE_EVENT_TYPES = {
  taskEscalated: 'task.escalated',
  taskCompleted: 'task.completed',
  checkoutCompleted: 'checkout.completed',
  orderReady: 'order.ready',
} as const;

export const MESSAGE_EVENT_VERSIONS = {
  taskEscalated: 1,
  taskCompleted: 1,
  checkoutCompleted: 1,
  orderReady: 1,
} as const;

export const MESSAGE_SOURCES = {
  workerManagement: 'worker-management',
  frontDesk: 'front-desk',
  kitchenManagement: 'kitchen-management',
} as const;
