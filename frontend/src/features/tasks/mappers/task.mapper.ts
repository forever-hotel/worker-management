import type { Task } from "../types/task";
import type { TaskApiRecord } from "../types/task-api";

export function calculateElapsedMinutes(
    submittedAt: string,
    now: number = Date.now(),
): number {
    const submittedTime =
        new Date(submittedAt).getTime();

    if (
        !Number.isFinite(submittedTime)
    ) {
        return 0;
    }

    return Math.max(
        0,
        Math.floor(
            (
                now -
                submittedTime
            ) /
            60_000,
        ),
    );
}

export function mapTaskApiRecord(
    task: TaskApiRecord,
): Task {
    return {
        id: task.task_id,
        roomNumber:
            task.room_number,
        category:
            task.category,
        description:
            task.description,
        priority:
            task.priority,
        status:
            task.status,
        source:
            task.source,
        submittedAt:
            task.submitted_at,
        elapsedMinutes:
            calculateElapsedMinutes(
                task.submitted_at,
            ),
    };
}
