import type { MyTask } from "@/features/assignments";

export type TaskDetail = MyTask & {
    floor: number;
    guestDescription: string;
    escalationThresholdMinutes: number;
};