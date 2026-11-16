import type {
    TaskCategory,
    TaskPriority,
} from "@/features/tasks/types/task";

export type ShiftCompletedTask = {
    task_id: string;
    room_number: string;
    category: TaskCategory;
    priority: TaskPriority;
    submitted_at: string;
    completed_at: string;
    turnaround_seconds: number;
};

export type ShiftSummary = {
    operational_day: {
        timezone: string;
        start_at: string;
        end_at: string;
    };

    worker: {
        worker_id: string;
        full_name: string;
        vocation: string | null;
    };

    active_task_count: number;
    completed_task_count: number;
    available_escalated_task_count: number;

    average_task_turnaround_seconds:
        number | null;

    completed_tasks:
        ShiftCompletedTask[];
};
