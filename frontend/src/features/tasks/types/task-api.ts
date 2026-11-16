import type {
    TaskCategory,
    TaskPriority,
    TaskSource,
    TaskStatus,
} from "./task";

export type TaskApiRecord = {
    task_id: string;
    room_number: string;
    category: TaskCategory;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    assigned_worker_id: string | null;
    booking_id: string | null;
    service_request_id: string | null;
    food_order_id: string | null;
    submitted_at: string;
    completed_at: string | null;
    source: TaskSource;
    created_at: string;
    updated_at: string;
};
