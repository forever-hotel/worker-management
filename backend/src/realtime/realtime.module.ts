import { Module } from '@nestjs/common';
import { RabbitMqModule } from '../messaging/rabbitmq/rabbitmq.module';
import { WkmsRealtimeGateway } from './wkms-realtime.gateway';

@Module({
  imports: [RabbitMqModule],
  providers: [WkmsRealtimeGateway],
  exports: [WkmsRealtimeGateway],
})
export class RealtimeModule {}
