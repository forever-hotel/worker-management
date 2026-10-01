export type ShiftSummary = {
    workerName: string;
    workerId: string;
    shiftStartedAt: string;
    shiftDuration: string;
    rating: string;
    tasksCompleted: number;
    averageCompletionMinutes: number;
    activeTasks: number;
    escalations: number;
};

export type CompletedShiftTask = {
    id: string;
    roomNumber: string;
    category:
        | "ROOM_CLEANING"
        | "EXTRA_TOWELS"
        | "WATER_BOTTLES"
        | "MAINTENANCE"
        | "LAUNDRY"
        | "FOOD_DELIVERY"
        | "OTHER";
    durationMinutes: number;
};

export type ConnectivityStatus = {
    online: boolean;
    networkLabel: string;
    cacheLabel: string;
    lastSync: string;
};

export const mockShiftSummary: ShiftSummary = {
    workerName: "Worker 001",
    workerId: "WK-001",
    shiftStartedAt: "08:00 AM",
    shiftDuration: "2h 41m",
    rating: "A+",
    tasksCompleted: 7,
    averageCompletionMinutes: 12,
    activeTasks: 2,
    escalations: 0,
};

export const mockCompletedShiftTasks: CompletedShiftTask[] = [
    {
        id: "REQ-0038",
        roomNumber: "302",
        category: "ROOM_CLEANING",
        durationMinutes: 14,
    },
    {
        id: "DEL-0025",
        roomNumber: "207",
        category: "FOOD_DELIVERY",
        durationMinutes: 8,
    },
    {
        id: "REQ-0034",
        roomNumber: "118",
        category: "EXTRA_TOWELS",
        durationMinutes: 7,
    },
    {
        id: "REQ-0031",
        roomNumber: "410",
        category: "LAUNDRY",
        durationMinutes: 18,
    },
];

export const mockConnectivity: ConnectivityStatus = {
    online: true,
    networkLabel: "Hotel Wi-Fi",
    cacheLabel: "My Tasks cached ✓",
    lastSync: "10:41 AM",
};