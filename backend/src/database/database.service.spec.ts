import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createConfigService = () =>
    ({
      get: jest
        .fn()
        .mockReturnValue(
          'postgresql://user:password@localhost:5432/test_database',
        ),
    }) as unknown as ConfigService;

  it('should throw when DATABASE_URL is not configured', () => {
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(() => new DatabaseService(configService)).toThrow(
      'DATABASE_URL environment variable is not configured',
    );
  });

  it('should establish a PostgreSQL connection on module init', async () => {
    const querySpy = jest
      .spyOn(Pool.prototype, 'query')
      .mockResolvedValue({ rows: [] } as never);

    const service = new DatabaseService(createConfigService());

    await service.onModuleInit();

    expect(querySpy).toHaveBeenCalledWith('SELECT 1');
  });

  it('should execute a database query', async () => {
    const querySpy = jest
      .spyOn(Pool.prototype, 'query')
      .mockResolvedValue({
        rows: [{ count: '0' }],
      } as never);

    const service = new DatabaseService(createConfigService());

    const result = await service.query(
      'SELECT COUNT(*) FROM wkms_tasks',
      [],
    );

    expect(querySpy).toHaveBeenCalledWith(
      'SELECT COUNT(*) FROM wkms_tasks',
      [],
    );

    expect(result.rows).toEqual([{ count: '0' }]);
  });

  it('should commit a successful transaction', async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };

    jest
      .spyOn(Pool.prototype, 'connect')
      .mockResolvedValue(mockClient as never);

    const service = new DatabaseService(createConfigService());

    const result = await service.withTransaction(async (client) => {
      await client.query('SELECT 1');
      return 'success';
    });

    expect(result).toBe('success');

    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(2, 'SELECT 1');
    expect(mockClient.query).toHaveBeenNthCalledWith(3, 'COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('should rollback a failed transaction', async () => {
    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };

    jest
      .spyOn(Pool.prototype, 'connect')
      .mockResolvedValue(mockClient as never);

    const service = new DatabaseService(createConfigService());

    await expect(
      service.withTransaction(async () => {
        throw new Error('TRANSACTION_FAILED');
      }),
    ).rejects.toThrow('TRANSACTION_FAILED');

    expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClient.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  it('should close the PostgreSQL pool on module destroy', async () => {
    const endSpy = jest
      .spyOn(Pool.prototype, 'end')
      .mockResolvedValue(undefined);

    const service = new DatabaseService(createConfigService());

    await service.onModuleDestroy();

    expect(endSpy).toHaveBeenCalled();
  });
});
