import {
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService {
    constructor(
        private readonly databaseService: DatabaseService,
    ) {}

    getLiveness() {
        return {
            status: 'ok',
            service: 'wkms',
        };
    }

    async getReadiness() {
        try {
            await this.databaseService.query('SELECT 1');

            return {
                status: 'ready',
                service: 'wkms',
                database: 'up',
            };
        } catch {
            throw new ServiceUnavailableException({
                status: 'not_ready',
                service: 'wkms',
                database: 'down',
            });
        }
    }
}