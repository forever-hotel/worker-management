import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class TaskRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const result = await this.databaseService.query(
      `SELECT *
       FROM wkms_tasks
       ORDER BY submitted_at ASC`,
    );

    return result.rows;
  }
}
