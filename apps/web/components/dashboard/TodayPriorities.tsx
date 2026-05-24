'use client';
import { useStore } from '@/stores/useStore';
import { CheckCircle2, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-400 bg-red-950/60 border-red-800/50',
  high: 'text-orange-400 bg-orange-950/60 border-orange-800/50',
  medium: 'text-yellow-400 bg-yellow-950/60 border-yellow-800/50',
  low: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50',
};

interface MockTask {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: string;
}

const MOCK_TASKS: MockTask[] = [
  { id: '1', title: 'Review Infoblox proposal', priority: 'high', due_date: null, status: 'today' },
  { id: '2', title: 'Prepare for client meeting (Acme Corp)', priority: 'high', due_date: null, status: 'today' },
  { id: '3', title: 'Follow up with Raj (Contract)', priority: 'medium', due_date: null, status: 'today' },
  { id: '4', title: 'Review project plan with team', priority: 'medium', due_date: null, status: 'today' },
  { id: '5', title: 'Finalize client status update email', priority: 'high', due_date: null, status: 'today' },
  { id: '6', title: 'Block time for deep work', priority: 'low', due_date: null, status: 'today' },
];

export default function TodayPriorities() {
  const { todayTasks, completeTask } = useStore();

  const tasks = todayTasks.length > 0 ? todayTasks.slice(0, 6) : MOCK_TASKS;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
          Today&apos;s Priorities
        </h2>
        <button className="text-xs text-indigo-400 hover:text-indigo-300">Reorder</button>
      </div>
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <div
            key={task.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 group transition-all"
          >
            <span className="text-xs text-slate-600 w-4 text-center font-mono">{i + 1}</span>
            <button
              onClick={() => completeTask(task.id)}
              className="flex-shrink-0 text-slate-600 hover:text-emerald-400 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <span className="flex-1 text-sm text-slate-200 group-hover:text-white transition-colors">
              {task.title}
            </span>
            <span
              className={clsx(
                'text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize',
                PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium
              )}
            >
              {task.priority}
            </span>
            <button className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-400 transition-all">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
