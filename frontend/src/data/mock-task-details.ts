import { mockTasks } from "@/data/mock-tasks";
import {
    mockActiveTasks,
    mockCompletedTasks,
} from "@/data/mock-my-tasks";
import type { TaskDetail } from "@/types/task-detail";

type DetailExtra = Pick<
    TaskDetail,
    "floor" | "guestDescription" | "escalationThresholdMinutes"
>;

const detailExtras: Record<string, DetailExtra> = {
    "REQ-0041": {
        floor: 1,
        guestDescription:
            "Could you please bring 4 mineral water bottles to the room?",
        escalationThresholdMinutes: 15,
    },

    "DEL-0029": {
        floor: 2,
        guestDescription:
            "Food order is ready for delivery to the guest.",
        escalationThresholdMinutes: 15,
    },

    "REQ-0038": {
        floor: 3,
        guestDescription:
            "Post-checkout room cleaning request.",
        escalationThresholdMinutes: 15,
    },

    "REQ-0042": {
        floor: 2,
        guestDescription:
            "Air conditioner is not cooling the room properly.",
        escalationThresholdMinutes: 15,
    },

    "REQ-0045": {
        floor: 1,
        guestDescription:
            "Room requires cleaning and fresh linen.",
        escalationThresholdMinutes: 15,
    },

    "REQ-0047": {
        floor: 3,
        guestDescription:
            "Guest requested two additional bath towels.",
        escalationThresholdMinutes: 15,
    },

    "DEL-0031": {
        floor: 4,
        guestDescription:
            "Food order is ready for delivery from the kitchen.",
        escalationThresholdMinutes: 15,
    },
};

const allMockTasks = [
    ...mockTasks,
    ...mockActiveTasks,
    ...mockCompletedTasks,
];

export const mockTaskDetails = Object.fromEntries(
    allMockTasks.map((task) => [
        task.id,
        {
            ...task,
            ...detailExtras[task.id],
        },
    ]),
) as Record<string, TaskDetail>;