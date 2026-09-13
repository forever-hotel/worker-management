export type TaskCategory =
    | "ROOM_CLEANING"
    | "EXTRA_TOWELS"
    | "WATER_BOTTLES"
    | "MAINTENANCE"
    | "LAUNDRY"
    | "FOOD_DELIVERY"
    | "OTHER";

export type TaskPriority = "HIGH" | "NORMAL";

export type TaskStatus =
    | "UNASSIGNED"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "ESCALATED";

export type TaskSource =
    | "GUEST_APP"
    | "FRONT_DESK"
    | "CHECKOUT_TRIGGER"
    | "KMS";

export type Task = {
    id: string;
    roomNumber: string;
    category: TaskCategory;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    source: TaskSource;
    submittedAt: string;
    elapsedMinutes: number;
    image?: string;
};