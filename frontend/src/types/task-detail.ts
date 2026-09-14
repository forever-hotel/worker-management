import type { MyTask } from "@/types/my-task";

export type TaskDetail = MyTask & {
    floor: number;
    guestDescription: string;
    escalationThresholdMinutes: number;
};