export const RABBITMQ_TOPOLOGY = {
  defaultExchange: 'forever.events',

  routingKeys: {
    taskEscalated: 'wkms.task.escalated.v1',
  },
} as const;

export const MESSAGE_EVENT_TYPES = {
  taskEscalated: 'task.escalated',
} as const;

export const MESSAGE_EVENT_VERSIONS = {
  taskEscalated: 1,
} as const;

export const MESSAGE_SOURCES = {
  workerManagement: 'worker-management',
} as const;
