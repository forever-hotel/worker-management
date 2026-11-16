import type { Task } from "@/features/tasks/types/task";

export type MyTask = Task & {
    claimedAtLabel?: string;
    completedAtLabel?: string;
    completionMinutes?: number;
};
