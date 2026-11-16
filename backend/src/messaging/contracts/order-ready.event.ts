/**
 * Proposed KMS -> WKMS order-ready RabbitMQ contract.
 *
 * Contract ID: KMS-INT-05
 * Exchange: forever.events
 * Routing key: kms.order.ready.v1
 *
 * The KMS producer and WKMS consumer must agree on
 * this contract before production integration.
 */

export interface OrderReadyEventData {
  foodOrderId: string;
  roomNumber: string;
}

export interface OrderReadyEvent {
  eventId: string;
  eventType: 'order.ready';
  eventVersion: 1;
  occurredAt: string;
  source: 'kitchen-management';
  data: OrderReadyEventData;
}
