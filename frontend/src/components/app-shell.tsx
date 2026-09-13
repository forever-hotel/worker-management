import type { ReactNode } from "react";
import {AppHeader} from "@/components/app-header";
import {TopTabs} from "@/components/top-tabs";
import {BottomNav} from "@/components/bottom-nav";

type AppSection = "queue" | "my-tasks" | "shift";

type AppShellProps = {
    title: string;
    activeTab: AppSection;
    queueCount?: number;
    myTasksCount?: number;
    children: ReactNode;
};

export function AppShell({
                             title,
                             activeTab,
                             queueCount,
                             myTasksCount,
                             children,
                         }: AppShellProps) {
    return (
        <div className="min-h-dvh bg-wkms-page">
            <div className="sticky top-0 z-40">
                <AppHeader title={title} />
                <TopTabs
                    activeTab={activeTab}
                    queueCount={queueCount}
                    myTasksCount={myTasksCount}
                />
            </div>

            <main className="w-full px-4 pb-24 pt-4">
                {children}
            </main>

            <BottomNav activeTab={activeTab} />
        </div>
    );
}