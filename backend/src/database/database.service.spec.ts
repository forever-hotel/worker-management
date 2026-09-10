import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

    const configService = {
      get: jest
        .fn()
        .mockReturnValue(
          'postgresql://user:password@localhost:5432/test_database',
        ),
    } as unknown as ConfigService;

    const service = new DatabaseService(configService);

    await service.onModuleInit();

    expect(querySpy).toHaveBeenCalledWith('SELECT 1');
  });

  it('should execute a database query', async () => {
    const querySpy = jest
      .spyOn(Pool.prototype, 'query')
      .mockResolvedValue({
        rows: [{ count: '0' }],
      } as never);

    const configService = {
      get: jest
        .fn()
        .mockReturnValue(
          'postgresql://user:password@localhost:5432/test_database',
        ),
    } as unknown as ConfigService;

    const service = new DatabaseService(configService);

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

  it('should close the PostgreSQL pool on module destroy', async () => {
    const endSpy = jest
      .spyOn(Pool.prototype, 'end')
      .mockResolvedValue(undefined);

    const configService = {
      get: jest
        .fn()
        .mockReturnValue(
          'postgresql://user:password@localhost:5432/test_database',
        ),
    } as unknown as ConfigService;

    const service = new DatabaseService(configService);

    await service.onModuleDestroy();

    expect(endSpy).toHaveBeenCalled();
  });
});
