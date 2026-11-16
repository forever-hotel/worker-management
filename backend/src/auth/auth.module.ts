import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WorkerRoleGuard } from './guards/worker-role.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, WorkerRoleGuard],
  exports: [AuthService, JwtAuthGuard, WorkerRoleGuard],
})
export class AuthModule {}
