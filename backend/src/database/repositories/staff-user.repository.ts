import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

export type StaffUserSummaryRecord = {
  worker_id: string;
  full_name: string;
  vocation: string;
};

@Injectable()
export class StaffUserRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findSummaryById(
    workerId: string,
  ): Promise<StaffUserSummaryRecord | null> {
    const result = await this.databaseService.query<StaffUserSummaryRecord>(
      `SELECT
                     worker_id,
                     full_name,
                     vocation
                 FROM staff_users
                 WHERE worker_id = $1
                   AND roles && ARRAY[$2,'ROOT']::text[]
                   AND is_active = TRUE
                 LIMIT 1`,
      [workerId, 'WORKER'],
    );

    return result.rows[0] ?? null;
  }
}
