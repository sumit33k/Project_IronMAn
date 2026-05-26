import TaskDetailClient from './_TaskDetail';

// Static export: no paths are pre-rendered; client component handles ID via useParams()
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <TaskDetailClient />;
}
