import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ShiftController } from './shift.controller';
import { ShiftService } from './shift.service';

@Module({
    imports: [
        AuthModule,
    ],
    controllers: [
        ShiftController,
    ],
    providers: [
        ShiftService,
    ],
})
export class ShiftModule {}