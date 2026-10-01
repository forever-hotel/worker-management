import type { Task } from "@/features/tasks";

export type MyTask = Task & {
    claimedAtLabel?: string;
    completedAtLabel?: string;
    completionMinutes?: number;
};