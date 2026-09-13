import type { MyTask } from "@/types/my-task";

export const mockActiveTasks: MyTask[] = [
    {
        id: "REQ-0041",
        roomNumber: "115",
        category: "WATER_BOTTLES",
        description: "Deliver 4 mineral water bottles to the guest.",
        priority: "NORMAL",
        status: "IN_PROGRESS",
        source: "GUEST_APP",
        submittedAt: "10:08 AM",
        elapsedMinutes: 13,
        claimedAtLabel: "10:14 AM",
    },
    {
        id: "DEL-0029",
        roomNumber: "207",
        category: "FOOD_DELIVERY",
        description: "Food order is ready for delivery from the kitchen.",
        priority: "NORMAL",
        status: "ASSIGNED",
        source: "KMS",
        submittedAt: "10:17 AM",
        elapsedMinutes: 6,
        claimedAtLabel: "10:22 AM",
    },
];

export const mockCompletedTasks: MyTask[] = [
    {
        id: "REQ-0038",
        roomNumber: "302",
        category: "ROOM_CLEANING",
        description: "Post-checkout room cleaning completed.",
        priority: "NORMAL",
        status: "COMPLETED",
        source: "CHECKOUT_TRIGGER",
        submittedAt: "9:41 AM",
        elapsedMinutes: 14,
        completedAtLabel: "9:55 AM",
        completionMinutes: 14,
    },
];