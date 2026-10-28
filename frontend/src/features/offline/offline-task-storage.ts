import type { TaskApiRecord } from "@/features/tasks/types/task-api";

const STORAGE_KEY = "wkms.offline.my-tasks.v1";
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

type OfflineSnapshot = {
  workerId: string;
  savedAt: number;
  tasks: TaskApiRecord[];
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function clearOfflineTasks(): void {
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Storage restrictions must not break online WKMS.
  }
}

function toSafeTask(task: TaskApiRecord): TaskApiRecord {
  // Explicit allowlist. Do not spread the API response.
  return {
    task_id: task.task_id,
    room_number: task.room_number,
    category: task.category,
    description: "",
    priority: task.priority,
    status: task.status,
    assigned_worker_id: task.assigned_worker_id,

    booking_id: null,
    service_request_id: null,
    food_order_id: null,

    submitted_at: task.submitted_at,
    completed_at: null,
    source: task.source,
    created_at: task.created_at,
    updated_at: task.updated_at,
  };
}

export function saveOfflineTasks(
    workerId: string,
    tasks: TaskApiRecord[],
): void {
  const storage = getStorage();

  if (!storage || !workerId.trim()) {
    return;
  }

  const safeTasks = tasks
      .filter(
          (task) =>
              task.assigned_worker_id === workerId &&
              (task.status === "ASSIGNED" ||
                  task.status === "IN_PROGRESS"),
      )
      .map(toSafeTask);

  const snapshot: OfflineSnapshot = {
    workerId,
    savedAt: Date.now(),
    tasks: safeTasks,
  };

  try {
    storage.setItem(
        STORAGE_KEY,
        JSON.stringify(snapshot),
    );
  } catch {
    // Offline caching must not interrupt online operations.
  }
}

export function loadOfflineTasks(
    workerId: string,
): TaskApiRecord[] | null {
  const storage = getStorage();

  if (!storage || !workerId.trim()) {
    return null;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const snapshot = JSON.parse(raw) as OfflineSnapshot;

    if (
        snapshot.workerId !== workerId ||
        typeof snapshot.savedAt !== "number" ||
        !Number.isFinite(snapshot.savedAt) ||
        snapshot.savedAt > Date.now() ||
        Date.now() - snapshot.savedAt > MAX_AGE_MS ||
        !Array.isArray(snapshot.tasks)
    ) {
      clearOfflineTasks();
      return null;
    }

    if (
        !snapshot.tasks.every(
            (task) =>
                task !== null &&
                typeof task === "object" &&
                task.assigned_worker_id === workerId &&
                (task.status === "ASSIGNED" ||
                    task.status === "IN_PROGRESS") &&
                typeof task.task_id === "string" &&
                typeof task.room_number === "string" &&
                typeof task.category === "string" &&
                typeof task.priority === "string" &&
                task.description === "" &&
                task.booking_id === null &&
                task.service_request_id === null &&
                task.food_order_id === null,
        )
    ) {
      clearOfflineTasks();
      return null;
    }

    // Reapply the allowlist when reading stored snapshots.
    return snapshot.tasks.map(toSafeTask);
  } catch {
    clearOfflineTasks();
    return null;
  }
}
