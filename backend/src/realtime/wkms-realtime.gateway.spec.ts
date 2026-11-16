import { jest } from '@jest/globals';
import { WkmsRealtimeGateway } from './wkms-realtime.gateway';
import { RabbitMqService } from '../messaging/rabbitmq/rabbitmq.service';

describe('Shared realtime relay', () => {
  it('publishes only scoped invalidations through RabbitMQ', async () => {
    const publishRealtime = jest
      .fn<(system: string, name: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    const relay = new WkmsRealtimeGateway({
      publishRealtime,
    } as unknown as RabbitMqService);
    relay.emitTaskCreated('private-record-id');
    expect(publishRealtime).toHaveBeenCalledWith('wkms', 'task.created');
    relay.emitTaskClaimed('private-record-id');
    expect(publishRealtime).toHaveBeenCalledWith('wkms', 'task.claimed');
    relay.emitTaskEscalated('private-record-id');
    expect(publishRealtime).toHaveBeenCalledWith('wkms', 'task.escalated');
    relay.emitTaskUpdated('private-record-id');
    expect(publishRealtime).toHaveBeenCalledWith('wkms', 'task.updated');
    relay.emitTaskCompleted('private-record-id');
    expect(publishRealtime).toHaveBeenCalledWith('wkms', 'task.completed');
    expect(JSON.stringify(publishRealtime.mock.calls)).not.toContain(
      'private-record-id',
    );
    await Promise.resolve();
  });
  it('does not undo a committed operation when the broker is unavailable', async () => {
    const publishRealtime = jest
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('offline'));
    const relay = new WkmsRealtimeGateway({
      publishRealtime,
    } as unknown as RabbitMqService);
    expect(() => relay.emitTaskCreated('record')).not.toThrow();
    await Promise.resolve();
  });
});
