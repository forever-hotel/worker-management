import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { FrontDeskServiceGuard } from '../auth/guards/front-desk-service.guard';
import { FrontDeskTaskService } from './front-desk-task.service';
@Controller('wkms/internal')
@UseGuards(FrontDeskServiceGuard)
export class FrontDeskTaskController {
  constructor(private readonly service: FrontDeskTaskService) {}
  @Post('tasks') create(@Body() body: { requestId?: string }) {
    return this.service.create(body?.requestId ?? '');
  }
  @Get('workers/available') available() {
    return this.service.availableWorkers();
  }
}
