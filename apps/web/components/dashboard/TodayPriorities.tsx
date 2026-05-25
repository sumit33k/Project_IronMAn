'use client';
import { useStore } from '@/stores/useStore';
import { CheckCircle2, MoreHorizontal, GripVertical } from 'lucide-react';
import { clsx } from 'clsx';

const PRIORITY_COLORS: Record<string, string> = {
  urgent:   'text-red-400    bg-red-950/60    border-red-800/50',
  high:     'text-orange-400 bg-orange-950/60 border-orange-800/50',
  medium:   'text-yellow-400 bg-yellow-950/60 border-yellow-800/50',
  low:      'text-emerald-400 bg-emerald-950/60 border-emerald-800/50',
};

const MOCK = [
  { id: '1', title: 'Review Infoblox proposal',             priority: 'high',   time: '9:00 AM',  status: 'today' },
  { id: '2', title: 'Prepare for client meeting (Acme)',    priority: 'high',   time: '11:00 AM', status: 'today' },
  { id: '3', title: 'Follow up with Raj (Contract)',        priority: 'medium', time: '12:30 PM', status: 'today' },
  { id: '4', title: 'Review project plan with team',        priority: 'medium', time: '1:00 PM',  status: 'today' },
  { id: '5', title: 'Finalize client status update email',  priority: 'high',   time: '4:00 PM',  status: 'today' },
  { id: '6', title: 'Block time for deep work',             priority: 'low',    time: '2:00 PM',  status: 'today' },
];

export default function TodayPriorities() {
  const { todayTasks, completeTask } = useStore();
  const tasks = todayTasks.length > 0
    ? todayTasks.slice(0, 6).map((t, i) => ({ ...t, time: MOCK[i]?.time ?? '' }))
    : MOCK;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          Today&apos;s Priorities
        </h2>
        <button className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
          <GripVertical className="w-3 h-3" /> Reorder
        </button>
      </div>

      <div className="space-y-1">
        {tasks.map((task, i) => (
          <div
            key={task.id}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 group transition-all cursor-pointer"
          >
            <span className="text-[11px] text-slate-600 w-4 text-center font-mono flex-shrink-0">{i + 1}</span>
            <button
              onClick={() => completeTask(task.id)}
              className="flex-shrink-0 text-slate-600 hover:text-emerald-400 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <span className="flex-1 text-[13px] text-slate-200 group-hover:text-white transition-colors truncate">
              {task.title}
            </span>
            <span className={clsx(
              'text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize flex-shrink-0',
              PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium
            )}>
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
            {'time' in task && (task as { time?: string }).time && (
              <span className="text-[11px] text-slate-500 flex-shrink-0 tabular-nums">
                {(task as { time?: string }).time}
              </span>
            )}
            <button className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-400 transition-all flex-shrink-0">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
