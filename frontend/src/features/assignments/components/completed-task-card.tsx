"use client";

import Image from "next/image";
import { Tag } from "antd";
import type { MyTask } from "../types/my-task";
import { taskCategoryImages } from "@/features/tasks";
import { useRouter } from "next/navigation";

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

export function CompletedTaskCard({ task }: CompletedTaskCardProps) {
  const imageSrc = taskCategoryImages[task.category];
  const isHighPriority = task.priority === "HIGH";

  const router = useRouter();

  const openTaskDetail = () => {
    router.push(`/tasks/${task.id}?from=my-tasks`);
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={openTaskDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openTaskDetail();
        }
      }}
      className="relative cursor-pointer overflow-hidden rounded-[10px] border border-[#ddd8cf] bg-white p-3 shadow-none transition hover:border-[#1a3c5e] sm:p-4"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-emerald-50/30"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[#5a5650]">{task.id}</span>

        {isHighPriority ? (
          <Tag color="error" className="m-0 text-xs font-medium">
            HIGH
          </Tag>
        ) : (
          <Tag className="m-0 text-xs font-medium text-wkms-navy">Normal</Tag>
        )}
      </div>

      {/* Main information */}
      <div className="mt-2 flex gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-wkms-navy px-2.5 py-1 text-xs font-semibold text-white">
              Room {task.roomNumber}
            </span>

            <span className="rounded-md border border-[#ddd8cf] bg-[#f9f7f4] px-2 py-1 text-xs text-[#5a5650]">
              {categoryLabels[task.category]}
            </span>
          </div>

          <p className="mt-2 text-sm leading-5 text-[#1a1a18]">
            {task.description}
          </p>
        </div>

        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#e8eef4] sm:h-14 sm:w-14">
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

        <span className="text-xs text-[#5a5650]">
          {task.completedAtLabel}
          {task.completionMinutes !== undefined &&
            ` · ${task.completionMinutes} min`}
        </span>
      </div>
    </article>
  );
}
