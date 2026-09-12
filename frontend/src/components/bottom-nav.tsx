"use client";

import Link from "next/link";
import {ClipboardList, ListChecks, Clock3} from "lucide-react";

type NavKey = "queue" | "my-tasks" | "shift";

type BottomNavProps = {
    activeTab: NavKey;
};

const navItems = [
    {
        key: "queue" as const,
        label: "Queue",
        href: "/queue",
        icon: ClipboardList,
    },
    {
        key: "my-tasks" as const,
        label: "My Tasks",
        href: "/my-tasks",
        icon: ListChecks,
    },
    {
        key: "shift" as const,
        label: "Shift",
        href: "/shift",
        icon: Clock3,
    },
];

export function BottomNav({ activeTab }: BottomNavProps) {
    return (
        <nav
            className="fixed inset-x-0 bottom-0 z-50 border-t border-wkms-border bg-white"
            aria-label="Primary navigation"
        >
            <div className="grid grid-cols-3">
                {navItems.map((item) => {
                    const isActive = item.key === activeTab;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            className={[
                                "flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-xs transition-colors",
                                isActive
                                    ? "font-semibold text-wkms-navy"
                                    : "text-slate-500",
                            ].join(" ")}
                        >
                            <Icon
                                size={21}
                                strokeWidth={isActive ? 2.4 : 1.8}
                                aria-hidden="true"
                            />

                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}