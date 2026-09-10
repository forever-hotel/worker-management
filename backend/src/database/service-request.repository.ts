import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class ServiceRequestRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const result = await this.databaseService.query(
      `SELECT *
       FROM wkms_service_requests
       ORDER BY submitted_at ASC`,
    );

    return result.rows;
  }
}
