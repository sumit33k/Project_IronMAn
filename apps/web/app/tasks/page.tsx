'use client';
import { useEffect, useState } from 'react';
import { CheckSquare, Circle, Clock, AlertTriangle } from 'lucide-react';
import { api, Task } from '@/lib/api';
import { clsx } from 'clsx';

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-slate-400',
};

const STATUS_TABS = ['all', 'today', 'in_progress', 'waiting', 'done'] as const;

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTasks().then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-indigo-400" /> All Tasks
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{tasks.length} total tasks</p>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-4 bg-[#1a2035] rounded-lg p-1 w-fit">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors',
              filter === s ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-card p-8 text-center text-slate-500 text-sm">Loading tasks…</div>
      ) : visible.length === 0 ? (
        <div className="glass-card p-8 text-center text-slate-500 text-sm">No tasks in this view.</div>
      ) : (
        <div className="space-y-2">
          {visible.map((task) => (
            <div key={task.id} className="glass-card p-3 flex items-start gap-3 hover:border-indigo-800/40 transition-colors">
              <Circle className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {task.due_date && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3" /> {task.due_date}
                  </span>
                )}
                <span className={clsx('text-[10px] font-medium capitalize', PRIORITY_COLOR[task.priority] || 'text-slate-400')}>
                  {task.priority}
                </span>
                <span className="text-[10px] text-slate-500 capitalize">{task.status.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
