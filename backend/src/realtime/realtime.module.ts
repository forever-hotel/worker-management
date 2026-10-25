import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WkmsRealtimeGateway } from './wkms-realtime.gateway';

@Module({
  imports: [AuthModule],
  providers: [WkmsRealtimeGateway],
  exports: [WkmsRealtimeGateway],
})
export class RealtimeModule {}
