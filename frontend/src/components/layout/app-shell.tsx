import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TopTabs } from "@/components/layout/top-tabs";
import { useTaskData } from "@/providers/task-data-provider";

type AppSection = "queue" | "my-tasks" | "shift";

type AppShellProps = {
  title: string;
  activeTab: AppSection;

  /*
   * Kept temporarily for backward compatibility with
   * any existing callers/tests during the DDP-80 refactor.
   *
   * Task counts now come from TaskDataProvider.
   */
  queueCount?: number;
  myTasksCount?: number;

  children: ReactNode;
};

export function AppShell({ title, activeTab, children }: AppShellProps) {
  const { queueCount, myTasksCount } = useTaskData();

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

      <main className="w-full px-4 pb-24 pt-4">{children}</main>

      <BottomNav activeTab={activeTab} />
    </div>
  );
}
