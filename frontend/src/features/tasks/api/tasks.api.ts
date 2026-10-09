import { apiRequest } from "@/lib/api-client";

import type { TaskApiRecord } from "../types/task-api";

export function getTaskQueue():
    Promise<TaskApiRecord[]> {
    return apiRequest<TaskApiRecord[]>(
        "/wkms/tasks/queue",
    );
}

export function getMyTasks():
    Promise<TaskApiRecord[]> {
    return apiRequest<TaskApiRecord[]>(
        "/wkms/tasks/my-tasks",
    );
}

export function claimTask(
    taskId: string,
): Promise<TaskApiRecord> {
    return apiRequest<TaskApiRecord>(
        `/wkms/tasks/${taskId}/claim`,
        {
            method: "POST",
        },
    );
}

export function startTask(
    taskId: string,
): Promise<TaskApiRecord> {
    return apiRequest<TaskApiRecord>(
        `/wkms/tasks/${taskId}/start`,
        {
            method: "POST",
        },
    );
}

export function completeTask(
    taskId: string,
): Promise<TaskApiRecord> {
    return apiRequest<TaskApiRecord>(
        `/wkms/tasks/${taskId}/complete`,
        {
            method: "POST",
        },
    );
}

export function getTaskDetail(
    taskId: string,
): Promise<TaskApiRecord> {
    return apiRequest<TaskApiRecord>(
        `/wkms/tasks/${taskId}`,
    );
}
