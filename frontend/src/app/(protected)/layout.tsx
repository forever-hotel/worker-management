import type {
    ReactNode,
} from "react";

import {
    RequireAuth,
} from "@/features/auth";

import {
    TaskDataProvider,
} from "@/providers/task-data-provider";

export default function ProtectedLayout({
                                            children,
                                        }: {
    children: ReactNode;
}) {
    return (
        <RequireAuth>
            <TaskDataProvider>
                {children}
            </TaskDataProvider>
        </RequireAuth>
    );
}