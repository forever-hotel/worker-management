"use client";

import Link from "next/link";

type TabKey = "queue" | "my-tasks" | "shift";

type TopTabsProps = {
    activeTab: TabKey;
};

const tabs = [
    {
        key: "queue" as const,
        label: "Queue",
        href: "/queue",
    },
    {
        key: "my-tasks" as const,
        label: "My Tasks",
        href: "/my-tasks",
    },
    {
        key: "shift" as const,
        label: "Shift",
        href: "/shift",
    },
];

export function TopTabs({ activeTab }: TopTabsProps) {
    return (
        <nav
            className="grid grid-cols-3 bg-wkms-navy px-3"
            aria-label="Worker sections"
        >
            {tabs.map((tab) => {
                const isActive = tab.key === activeTab;

                return (
                    <Link
                        key={tab.key}
                        href={tab.href}
                        className={[
                            "relative flex min-h-11 items-center justify-center text-sm transition-colors",
                            isActive
                                ? "font-semibold text-[#ffffff]"
                                : "font-medium text-[#ffffff]/60",
                        ].join(" ")}
                    >
                        {tab.label}

                        {isActive && (
                            <span
                                className="absolute inset-x-0 bottom-0 mx-auto h-0.5 w-full bg-wkms-gold"
                                aria-hidden="true"
                            />
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}