'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, ArrowDownRight, Loader2 } from 'lucide-react';
import { useStore } from '@/stores/useStore';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-400 border-red-800/40',
  high:   'bg-orange-500/10 text-orange-400 border-orange-800/40',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-800/40',
  low:    'bg-emerald-500/10 text-emerald-400 border-emerald-800/40',
};

export default function TodayPage() {
  const { todayTasks, overdueTasks, loadTasks, completeTask, deferTask } = useStore();
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [deferring, setDeferring] = useState<string | null>(null);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    await api.createTask({ title: newTitle.trim(), status: 'today', priority: 'medium' });
    setNewTitle('');
    await loadTasks();
    setCreating(false);
  };

  const handleDefer = async (id: string) => {
    setDeferring(id);
    await deferTask(id);
    setDeferring(null);
  };

  const allTasks = [
    ...overdueTasks.map((t) => ({ ...t, _overdue: true })),
    ...todayTasks.map((t) => ({ ...t, _overdue: false })),
  ];

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Today Queue</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Add task */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-6">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task to today's queue…"
          className="flex-1 bg-[#131720] border border-[#1e2847] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-xl text-sm text-white font-medium transition-colors"
        >
          {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Add
        </button>
      </form>

      {/* Task list */}
      <div className="space-y-2">
        {overdueTasks.length > 0 && (
          <p className="text-xs text-red-400 font-medium uppercase tracking-wider mb-1">Overdue</p>
        )}

        {allTasks.map((task: any) => (
          <div
            key={task.id}
            className={clsx(
              'glass-card p-3 flex items-center gap-3 group hover:border-indigo-800/50 transition-all',
              task._overdue && 'border-red-900/50 bg-red-950/10',
            )}
          >
            <button
              onClick={() => completeTask(task.id)}
              className="flex-shrink-0 text-slate-600 hover:text-emerald-400 transition-colors"
            >
              <CheckCircle2 className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-white">{task.title}</p>
              {task.description && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>
              )}
              {task.due_date && (
                <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Due {task.due_date}
                </p>
              )}
            </div>

            {task._overdue && (
              <span className="text-[10px] text-red-400 bg-red-950/60 border border-red-900/40 px-2 py-0.5 rounded-full flex-shrink-0">
                overdue
              </span>
            )}

            <span
              className={clsx(
                'text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium flex-shrink-0',
                PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium,
              )}
            >
              {task.priority}
            </span>

            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
              <button
                onClick={() => handleDefer(task.id)}
                disabled={deferring === task.id}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-amber-950/40 text-amber-400 hover:bg-amber-950/70 transition-colors"
              >
                {deferring === task.id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <ArrowDownRight className="w-3 h-3" />
                }
                Defer
              </button>
            </div>
          </div>
        ))}

        {allTasks.length === 0 && (
          <div className="glass-card p-10 text-center">
            <p className="text-slate-400 text-sm">No tasks for today.</p>
            <p className="text-slate-600 text-xs mt-1">Add one above or use the command bar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
