import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

export type StaffUserAuthRecord = {
    worker_id: string;
    full_name: string;
    username: string;
    password_hash: string;
    role: string;
    is_active: boolean;
};

export type StaffUserSummaryRecord = {
    worker_id: string;
    full_name: string;
    vocation: string;
};

@Injectable()
export class StaffUserRepository {
    constructor(
        private readonly databaseService: DatabaseService,
    ) {}

    async findByUsername(
        username: string,
    ): Promise<StaffUserAuthRecord | null> {
        const result =
            await this.databaseService.query<StaffUserAuthRecord>(
                `SELECT
                     worker_id,
                     full_name,
                     username,
                     password_hash,
                     role,
                     is_active
                 FROM staff_users
                 WHERE username = $1
                     LIMIT 1`,
                [username],
            );

        return result.rows[0] ?? null;
    }

    async findSummaryById(
        workerId: string,
    ): Promise<
        StaffUserSummaryRecord | null
    > {
        const result =
            await this.databaseService
                .query<StaffUserSummaryRecord>(
                    `SELECT
                     worker_id,
                     full_name,
                     vocation
                 FROM staff_users
                 WHERE worker_id = $1
                   AND role = $2
                   AND is_active = TRUE
                 LIMIT 1`,
                    [
                        workerId,
                        'WORKER',
                    ],
                );

        return result.rows[0] ?? null;
    }
}