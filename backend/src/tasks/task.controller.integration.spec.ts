import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskRepository } from '../database/task.repository';

describe('GET /tasks/queue', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        TaskService,
        {
          provide: TaskRepository,
          useValue: {
            findAll: async () => [],
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with an empty task queue', async () => {
    await request(app.getHttpServer())
      .get('/tasks/queue')
      .expect(200)
      .expect([]);
  });
});


