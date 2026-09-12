import { AppShell } from "@/components/app-shell";

export default function MyTasksPage() {
    return (
        <AppShell title="My Tasks" activeTab="my-tasks">
            <p className="text-sm text-slate-600">
                My Tasks content will be implemented here.
            </p>
        </AppShell>
    );
}