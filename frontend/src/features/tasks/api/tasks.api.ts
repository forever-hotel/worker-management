import { apiRequest } from "@/lib/api-client";

import type { TaskApiRecord } from "../types/task-api";

export function getTaskQueue():
    Promise<TaskApiRecord[]> {
    return apiRequest<TaskApiRecord[]>(
        "/wkms/tasks/queue",
    );
}

export type TaskCapacity = {
    activeTaskCount: number;
    maxActiveTasks: number;
    remainingCapacity: number;
};

export function getTaskCapacity(): Promise<TaskCapacity> {
    return apiRequest<TaskCapacity>("/wkms/tasks/capacity");
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


export type OfflineTaskActionRequest = {
    taskId: string;
    requestId: string;
    action: "START" | "COMPLETE";
};

export type OfflineTaskActionResponse = {
    task: TaskApiRecord;
    replayed: boolean;
};

/**
 * Submit one offline action using its original request ID.
 *
 * A retry must reuse the same requestId so the backend can
 * return the previously committed result without repeating
 * the task transition, audit, or completion event.
 *
 * This function does not automatically retry requests.
 */
export function submitOfflineTaskAction({
                                            taskId,
                                            requestId,
                                            action,
                                        }: OfflineTaskActionRequest): Promise<OfflineTaskActionResponse> {
    return apiRequest<OfflineTaskActionResponse>(
        `/wkms/tasks/${encodeURIComponent(taskId)}/offline-action`,
        {
            method: "POST",
            body: JSON.stringify({
                requestId,
                action,
            }),
        },
    );
}


export type OfflineTaskActionReceipt = {
    action: "START" | "COMPLETE";
    task: TaskApiRecord;
};

/**
 * Read the committed receipt of an offline task action.
 *
 * This request is read-only: it does not start or complete
 * a task and does not create a new idempotency key.
 */
export function getOfflineTaskActionReceipt(
    taskId: string,
    requestId: string,
): Promise<OfflineTaskActionReceipt> {
    return apiRequest<OfflineTaskActionReceipt>(
        `/wkms/tasks/${encodeURIComponent(taskId)}/offline-action/${encodeURIComponent(requestId)}`,
    );
}