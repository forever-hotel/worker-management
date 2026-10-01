import { TaskDetailScreen } from "@/features/tasks";

type TaskDetailPageProps = {
    params: Promise<{
        taskId: string;
    }>;
};

export default async function TaskDetailPage({
                                                 params,
                                             }: TaskDetailPageProps) {
    const { taskId } = await params;

    return <TaskDetailScreen taskId={taskId} />;
}