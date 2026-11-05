import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TaskRepository } from '../database/repositories/task.repository';
import { appendTaskAudit } from '../database/repositories/task-audit.repository';
import { WkmsRealtimeGateway } from '../realtime/wkms-realtime.gateway';
@Injectable()
export class FrontDeskTaskService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tasks: TaskRepository,
    private readonly realtime: WkmsRealtimeGateway,
  ) {}
  async create(requestId: string) {
    if (
      typeof requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestId,
      )
    )
      throw new BadRequestException('A valid requestId is required');
    requestId = requestId.toLowerCase();
    const result = await this.database.withTransaction(async (client) => {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        ['fds-request:' + requestId],
      );
      const existing = await client.query(
        'SELECT * FROM public.wkms_tasks WHERE service_request_id=$1',
        [requestId],
      );
      if (existing.rows[0]) return { task: existing.rows[0], created: false };
      const source = await client.query(
        `SELECT r.*, b.status::text AS booking_status FROM public.foss_service_requests r
        JOIN public.bookings b ON b.booking_id=r.booking_id AND b.room_number=r.room_number
        WHERE r.request_id=$1 AND r.source IN ('FRONT_DESK','GUEST_APP') FOR SHARE OF r,b`,
        [requestId],
      );
      const request = source.rows[0];
      if (!request) throw new NotFoundException('Front Desk request not found');
      if (
        request.booking_status !== 'CHECKED_IN' ||
        request.status !== 'SUBMITTED'
      )
        throw new ConflictException('Request is no longer eligible for a task');
      const inserted = await client.query(
        `INSERT INTO public.wkms_tasks(room_number,category,description,priority,status,source,service_request_id,booking_id,submitted_at)
        VALUES($1,$2,$3,$8,'UNASSIGNED',$7,$4,$5,$6) RETURNING *`,
        [
          request.room_number,
          request.category,
          request.description,
          requestId,
          request.booking_id,
          request.submitted_at,
          request.source === 'GUEST_APP' ? 'GUEST_APP' : 'FRONT_DESK',
          request.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
        ],
      );
      const task = inserted.rows[0];
      if (!task) throw new Error('Task insert failed');
      await appendTaskAudit(client, {
        taskId: task.task_id,
        action: 'TASK_CREATED',
        actor: { type: 'SYSTEM' },
        previousStatus: null,
        newStatus: 'UNASSIGNED',
      });
      return { task, created: true };
    });
    if (result.created) this.realtime.emitTaskCreated(result.task.task_id);
    const task = result.task;
    return {
      taskId: task.task_id,
      roomNumber: task.room_number,
      category: task.category,
      status: task.status,
      priority: task.priority,
      createdAt: task.created_at,
    };
  }
  async availableWorkers() {
    return (await this.tasks.findEligibleWorkers()).map((worker) => ({
      workerId: worker.workerId,
      displayName: worker.fullName,
      activeTaskCount: worker.activeTaskCount,
      maxActiveTasks: worker.maxActiveTasks,
    }));
  }
}
