import Image from "next/image";
import { Tag } from "antd";
import type { MyTask } from "@/types/my-task";
import { taskCategoryImages } from "@/lib/task-images";

type CompletedTaskCardProps = {
    task: MyTask;
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

export function CompletedTaskCard({
                                      task,
                                  }: CompletedTaskCardProps) {
    const imageSrc = taskCategoryImages[task.category];
    const isHighPriority = task.priority === "HIGH";

    return (
        <article className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
             <div
                className="pointer-events-none absolute inset-0 bg-emerald-50/30"
                aria-hidden="true"
            />
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-slate-600">
                      {task.id}
                    </span>

                    {isHighPriority ? (
                        <Tag color="error" className="m-0 text-xs font-medium">
                            HIGH
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

                {/* Completed status + completion details */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-md bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      ✓ Completed
                    </span>

                    <span className="text-xs text-slate-500">
                      {task.completedAtLabel}
                                {task.completionMinutes !== undefined &&
                                    ` · ${task.completionMinutes} min`}
                    </span>
                </div>
        </article>
    );
}