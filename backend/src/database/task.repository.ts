import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class TaskRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const result = await this.databaseService.query(
      `SELECT *
       FROM wkms_tasks
       WHERE status = $1
       ORDER BY submitted_at ASC`,
      ['UNASSIGNED'],
    );

    return result.rows;
  }
}
