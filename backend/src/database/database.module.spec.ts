import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseModule } from './database.module';
import { DatabaseService } from './database.service';
import { CheckoutTaskRepository } from './repositories/checkout-task.repository';
import { ServiceRequestRepository } from './repositories/service-request.repository';
import { StaffUserRepository } from './repositories/staff-user.repository';
import { TaskRepository } from './repositories/task.repository';

describe('DatabaseModule', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({})
      .compile();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('registers and exports CheckoutTaskRepository', () => {
    expect(moduleRef.get(CheckoutTaskRepository)).toBeInstanceOf(
      CheckoutTaskRepository,
    );
  });

  it('preserves existing WKMS database providers', () => {
    expect(moduleRef.get(TaskRepository)).toBeInstanceOf(TaskRepository);

    expect(moduleRef.get(ServiceRequestRepository)).toBeInstanceOf(
      ServiceRequestRepository,
    );

    expect(moduleRef.get(StaffUserRepository)).toBeInstanceOf(
      StaffUserRepository,
    );
  });

  it('uses the registered database service', () => {
    expect(moduleRef.get(DatabaseService)).toEqual({});
  });
});
