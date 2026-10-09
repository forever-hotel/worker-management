"use client";

import { Button, Tag } from "antd";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { taskCategoryImages } from "../constants/task-images.constants";
import type { Task } from "../types/task";

type TaskCardProps = {
  task: Task;
  onClaim?: (task: Task) => void;
  claimLoading?: boolean;
};

const categoryLabels: Record<Task["category"], string> = {
  ROOM_CLEANING: "Room Cleaning",
  EXTRA_TOWELS: "Extra Towels",
  WATER_BOTTLES: "Water Bottles",
  MAINTENANCE: "Maintenance",
  LAUNDRY: "Laundry",
  FOOD_DELIVERY: "Food Delivery",
  OTHER: "Other",
};

export function TaskCard({
  task,
  onClaim,
  claimLoading = false,
}: TaskCardProps) {
  const router = useRouter();

  const isEscalated = task.status === "ESCALATED";

  const isHighPriority = task.priority === "HIGH";

  const isDelivery = task.category === "FOOD_DELIVERY";

  const imageSrc = task.image ?? taskCategoryImages[task.category];

  const openTaskDetail = () => {
    router.push(`/tasks/${task.id}?from=queue`);
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
      className={[
        "cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md sm:p-4",
        isEscalated ? "border-amber-400 bg-amber-50/60" : "border-slate-200",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-600">{task.id}</span>

        {isEscalated ? (
          <Tag color="warning" className="m-0 text-xs font-medium">
            ⚠ Escalated
          </Tag>
        ) : isHighPriority ? (
          <Tag color="error" className="m-0 text-xs font-medium">
            HIGH
          </Tag>
        ) : isDelivery ? (
          <Tag color="blue" className="m-0 text-xs font-medium">
            Delivery
          </Tag>
        ) : (
          <Tag className="m-0 text-xs font-medium text-wkms-navy">Normal</Tag>
        )}
      </div>

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

      {isEscalated && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-2 text-xs font-medium text-amber-800">
          ● Unclaimed {task.elapsedMinutes} min · Escalated
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
          {task.elapsedMinutes} min ago
        </span>

        <Button
          type="primary"
          size="small"
          loading={claimLoading}
          className="min-h-9 min-w-28 font-semibold sm:min-h-10 sm:min-w-32"
          style={{
            boxShadow: "none",
          }}
          onClick={(event) => {
            event.stopPropagation();

            onClaim?.(task);
          }}
        >
          Claim Task
        </Button>
      </div>
    </article>
  );
}
