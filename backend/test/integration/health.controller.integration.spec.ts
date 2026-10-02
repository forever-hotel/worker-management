import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import request from 'supertest';
import { DatabaseService } from '../../src/database/database.service';
import { HealthController } from '../../src/health/health.controller';
import { HealthService } from '../../src/health/health.service';

type QueryMock = (
    text: string,
    params?: unknown[],
) => Promise<{ rows: unknown[] }>;

describe('HealthController integration', () => {
    let app: INestApplication;

    const query = jest.fn<QueryMock>();

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [HealthController],
            providers: [
                HealthService,
                {
                    provide: DatabaseService,
                    useValue: {
                        query,
                    },
                },
            ],
        }).compile();

        app = moduleRef.createNestApplication();

        await app.init();
    });

    beforeEach(() => {
        query.mockReset();
    });

    afterAll(async () => {
        await app.close();
    });

    it('should expose a public liveness endpoint', async () => {
        await request(app.getHttpServer())
            .get('/health/live')
            .expect(200)
            .expect({
                status: 'ok',
                service: 'wkms',
            });

        expect(query).not.toHaveBeenCalled();
    });

    it('should return ready when the database is available', async () => {
        query.mockResolvedValue({
            rows: [{ result: 1 }],
        });

        await request(app.getHttpServer())
            .get('/health/ready')
            .expect(200)
            .expect({
                status: 'ready',
                service: 'wkms',
                database: 'up',
            });

        expect(query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return 503 when the database is unavailable', async () => {
        query.mockRejectedValue(
            new Error('Database unavailable'),
        );

        await request(app.getHttpServer())
            .get('/health/ready')
            .expect(503);
    });
});