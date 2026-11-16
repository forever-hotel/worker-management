import { apiRequest } from '@/lib/api-client';
import { getTaskCapacity } from './tasks.api';

jest.mock('@/lib/api-client', () => ({ apiRequest: jest.fn() }));

it('uses the worker-authenticated capacity endpoint without passing an arbitrary worker ID', async () => {
  jest.mocked(apiRequest).mockResolvedValueOnce({ activeTaskCount: 1, maxActiveTasks: 4, remainingCapacity: 3 });
  await expect(getTaskCapacity()).resolves.toMatchObject({ maxActiveTasks: 4 });
  expect(apiRequest).toHaveBeenCalledWith('/wkms/tasks/capacity');
});
