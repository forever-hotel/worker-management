import { jest } from '@jest/globals';
import { ServiceRequestConsumer } from './service-request.consumer';
import { ConfigService } from '@nestjs/config';
import { FrontDeskTaskService } from '../../tasks/front-desk-task.service';
import type {
  ConsumeMessage,
  Channel,
  ConfirmChannel,
  ChannelModel,
} from 'amqplib';
const requestId = '11111111-1111-4111-8111-111111111111';
describe('Service request delivery', () => {
  function setup(fail = false) {
    const create = jest.fn<() => Promise<unknown>>();
    if (fail) create.mockRejectedValue(new Error('database offline'));
    else create.mockResolvedValue({ taskId: 'task' });
    const consumer = new ServiceRequestConsumer(
      {} as ConfigService,
      { create } as unknown as FrontDeskTaskService,
    );
    const ack = jest.fn(),
      nack = jest.fn(),
      close = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const sendToQueue = jest.fn<(...args: unknown[]) => boolean>((...args) => {
      (args[3] as (e: null) => void)(null);
      return true;
    });
    const message = {
      content: Buffer.from(
        JSON.stringify({
          eventType: 'service.requested',
          eventVersion: 1,
          source: 'front-desk',
          eventId: 'service-request:' + requestId,
          data: { requestId },
        }),
      ),
      properties: { headers: {} },
    } as ConsumeMessage;
    return {
      consumer,
      create,
      ack,
      nack,
      close,
      sendToQueue,
      message,
      run: () =>
        consumer.accept(
          message,
          { ack, nack } as unknown as Channel,
          { sendToQueue } as unknown as ConfirmChannel,
          { close } as unknown as ChannelModel,
        ),
    };
  }
  it('acknowledges only after idempotent task creation', async () => {
    const f = setup();
    await f.run();
    expect(f.create).toHaveBeenCalledWith(requestId);
    expect(f.ack).toHaveBeenCalledWith(f.message);
  });
  it('confirms delayed retry before acknowledging transient failures', async () => {
    const f = setup(true);
    await f.run();
    expect(f.sendToQueue).toHaveBeenCalled();
    expect(f.ack).toHaveBeenCalledWith(f.message);
    expect(f.nack).not.toHaveBeenCalled();
  });
  it('dead-letters malformed events without calling the task owner', async () => {
    const f = setup();
    f.message.content = Buffer.from('{');
    await f.run();
    expect(f.nack).toHaveBeenCalledWith(f.message, false, false);
    expect(f.create).not.toHaveBeenCalled();
  });
  it('dead-letters after five retries', async () => {
    const f = setup(true);
    f.message.properties.headers = { 'x-service-attempts': 5 };
    await f.run();
    expect(f.nack).toHaveBeenCalledWith(f.message, false, false);
    expect(f.sendToQueue).not.toHaveBeenCalled();
  });
});
