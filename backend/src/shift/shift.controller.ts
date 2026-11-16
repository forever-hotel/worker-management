import {
    Controller,
    Get,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { CurrentWorker } from '../auth/decorators/current-worker.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkerRoleGuard } from '../auth/guards/worker-role.guard';
import type { AuthenticatedWorker } from '../auth/types/authenticated-worker';
import { ShiftService } from './shift.service';

@Controller('wkms/shift')
@UseGuards(
    JwtAuthGuard,
    WorkerRoleGuard,
)
export class ShiftController {
    constructor(
        private readonly shiftService:
        ShiftService,
    ) {}

    @Get('summary')
    async getSummary(
        @CurrentWorker()
        worker:
            AuthenticatedWorker | undefined,
    ) {
        const authenticatedWorker =
            this.requireWorker(worker);

        return this.shiftService.getSummary(
            authenticatedWorker.worker_id,
        );
    }

    private requireWorker(
        worker:
            AuthenticatedWorker | undefined,
    ): AuthenticatedWorker {
        if (!worker) {
            throw new UnauthorizedException(
                'Authenticated worker identity is required',
            );
        }

        return worker;
    }
}