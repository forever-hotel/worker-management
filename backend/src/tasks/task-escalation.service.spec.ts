import { jest } from '@jest/globals';
import { TaskRepository } from '../database/repositories/task.repository';
import { TaskEscalationService } from './task-escalation.service';

type EscalateOverdueTasksMock =
    () => Promise<unknown[]>;

describe('TaskEscalationService', () => {
    it('should run the backend escalation process', async () => {
        const escalateOverdueTasks =
            jest
                .fn<EscalateOverdueTasksMock>()
                .mockResolvedValue([]);

        const service =
            new TaskEscalationService({
                escalateOverdueTasks,
            } as unknown as TaskRepository);

        await service.processOverdueTasks();

        expect(
            escalateOverdueTasks,
        ).toHaveBeenCalledTimes(1);
    });
});