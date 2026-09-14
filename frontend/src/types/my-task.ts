import type { Task } from "@/types/task";

export type MyTask = Task & {
    claimedAtLabel?: string;
    completedAtLabel?: string;
    completionMinutes?: number;
};