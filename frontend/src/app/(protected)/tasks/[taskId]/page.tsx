import { TaskDetailScreen } from "@/features/tasks";

type TaskDetailPageProps = {
  params: Promise<{
    taskId: string;
  }>;
  searchParams: Promise<{
    from?: string | string[];
  }>;
};

export default async function TaskDetailPage({
  params,
  searchParams,
}: TaskDetailPageProps) {
  const [{ taskId }, query] = await Promise.all([params, searchParams]);

  const from = typeof query.from === "string" ? query.from : undefined;

  return <TaskDetailScreen taskId={taskId} from={from} />;
}
