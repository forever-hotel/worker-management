"use client";

export type TaskFilter =
    | "ALL"
    | "CLEANING"
    | "MAINTENANCE"
    | "DELIVERY";

type TaskFiltersProps = {
    activeFilter: TaskFilter;
    onChange: (filter: TaskFilter) => void;
};

const filters: { value: TaskFilter; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "CLEANING", label: "Cleaning" },
    { value: "MAINTENANCE", label: "Maintenance" },
    { value: "DELIVERY", label: "Delivery" },
];

export function TaskFilters({
                                activeFilter,
                                onChange,
                            }: TaskFiltersProps) {
    return (
        <div
            className="hide-scrollbar flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain"
            aria-label="Task filters"
        >
            {filters.map((filter) => {
                const isActive = activeFilter === filter.value;

                return (
                    <button
                        key={filter.value}
                        type="button"
                        onClick={() => onChange(filter.value)}
                        aria-pressed={isActive}
                        className={[
                            "shrink-0 whitespace-nowrap rounded-full border px-5 py-1.5 text-xs font-medium transition",
                            "sm:px-4 sm:text-sm",
                            isActive
                                ? "border-wkms-navy bg-wkms-navy text-white"
                                : "border-slate-300 bg-white text-slate-600",
                        ].join(" ")}
                    >
                        {filter.label}
                    </button>
                );
            })}
        </div>
    );
}