import Image from "next/image";
import { Button, Tag } from "antd";
import type { MyTask } from "@/types/my-task";
import { taskCategoryImages } from "@/lib/task-images";

type MyTaskCardProps = {
    task: MyTask;
    onStart?: (taskId: string) => void;
    onComplete?: (taskId: string) => void;
};

const categoryLabels: Record<MyTask["category"], string> = {
    ROOM_CLEANING: "Room Cleaning",
    EXTRA_TOWELS: "Extra Towels",
    WATER_BOTTLES: "Water Bottles",
    MAINTENANCE: "Maintenance",
    LAUNDRY: "Laundry",
    FOOD_DELIVERY: "Food Delivery",
    OTHER: "Other",
};

export function MyTaskCard({
                               task,
                               onStart,
                               onComplete,
                           }: MyTaskCardProps) {
    const isAssigned = task.status === "ASSIGNED";
    const isInProgress = task.status === "IN_PROGRESS";
    const isDelivery = task.category === "FOOD_DELIVERY";

    const imageSrc = taskCategoryImages[task.category];

    return (
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            {/* Top row */}
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-600">
                  {task.id}
                </span>

                {isDelivery ? (
                    <Tag color="blue" className="m-0 text-xs font-medium">
                        Delivery
                    </Tag>
                ) : (
                    <Tag className="m-0 text-xs font-medium text-wkms-navy">
                        Normal
                    </Tag>
                )}
            </div>

            {/* Main information */}
            <div className="mt-2 flex gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-wkms-navy px-2.5 py-1 text-xs font-semibold text-white">
              Room {task.roomNumber}
            </span>

                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                          {categoryLabels[task.category]}
                        </span>
                    </div>

                    <p className="mt-2 text-sm leading-5 text-slate-700">
                        {task.description}
                    </p>
                </div>

                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-14 sm:w-14">
                    <Image
                        src={imageSrc}
                        alt={`${categoryLabels[task.category]} for Room ${task.roomNumber}`}
                        fill
                        sizes="(max-width: 640px) 48px, 56px"
                        className="object-cover"
                    />
                </div>
            </div>

            {/* Status */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span
                    className={[
                        "rounded-md px-2.5 py-1 text-xs font-medium",
                        isInProgress
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-50 text-blue-700",
                    ].join(" ")}
                >
                  ● {isInProgress ? "In Progress" : "Assigned"}
                </span>

                {task.claimedAtLabel && (
                    <span className="text-xs text-slate-500">
                        Claimed {task.claimedAtLabel}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="mt-3">
                {isAssigned ? (
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                        <Button
                            size="small"
                            className="min-h-9 w-full font-semibold shadow-none sm:min-h-10"
                            style={{ boxShadow: "none" }}
                            onClick={() => onStart?.(task.id)}
                        >
                            In Progress
                        </Button>

                        <Button
                            type="primary"
                            size="small"
                            className="min-h-9 w-full font-semibold shadow-none sm:min-h-10"
                            style={{ boxShadow: "none" }}
                            onClick={() => onComplete?.(task.id)}
                        >
                            {isDelivery ? "Mark Delivered" : "Mark Complete"}
                        </Button>
                    </div>
                ) : (
                    <Button
                        type="primary"
                        size="small"
                        block
                        className="min-h-9 font-semibold shadow-none sm:min-h-10"
                        style={{ boxShadow: "none" }}
                        onClick={() => onComplete?.(task.id)}
                    >
                        {isDelivery ? "Mark Delivered" : "Mark Complete"}
                    </Button>
                )}
            </div>
        </article>
    );
}