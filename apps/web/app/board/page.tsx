'use client';

import { useEffect } from 'react';
import { useStore } from '@/stores/useStore';
import { api } from '@/lib/api';
import { Plus } from 'lucide-react';

const LANES = [
  { key: 'inbox',       label: 'Inbox',       accent: 'border-slate-500' },
  { key: 'today',       label: 'Today',       accent: 'border-indigo-500' },
  { key: 'in_progress', label: 'In Progress', accent: 'border-blue-500' },
  { key: 'waiting',     label: 'Waiting',     accent: 'border-amber-500' },
  { key: 'deferred',    label: 'Deferred',    accent: 'border-slate-600' },
  { key: 'completed',   label: 'Done',        accent: 'border-emerald-500' },
];

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-yellow-400', low: 'bg-emerald-400',
};

export default function BoardPage() {
  const { tasks, loadTasks } = useStore();

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  const move = async (taskId: string, status: string) => {
    await api.updateTask(taskId, { status });
    await loadTasks();
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kanban Board</h1>
          <p className="text-xs text-slate-500 mt-0.5">{tasks.length} tasks across all lanes</p>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto flex-1 pb-4 min-h-0">
        {LANES.map((lane) => {
          const laneTasks = tasks.filter((t) => t.status === lane.key);
          const nextLanes = LANES.filter((l) => l.key !== lane.key).slice(0, 3);

          return (
            <div
              key={lane.key}
              className={`flex-shrink-0 w-60 flex flex-col rounded-xl border-t-2 ${lane.accent} bg-[#131720] border border-[#1e2847] border-t-0`}
              style={{ borderTopWidth: '2px' }}
            >
              {/* Lane header */}
              <div className="px-3 py-2.5 flex items-center justify-between border-b border-[#1e2847]">
                <span className="text-xs font-semibold text-white">{lane.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2035] text-slate-400 tabular-nums">
                  {laneTasks.length}
                </span>
              </div>

              {/* Task cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                {laneTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-[#1a2035] rounded-lg p-2.5 border border-[#1e2847] hover:border-indigo-800/60 cursor-pointer transition-all group"
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <span
                        className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium}`}
                      />
                      <p className="text-xs text-white leading-tight line-clamp-2">{task.title}</p>
                    </div>

                    {task.category && task.category !== 'general' && (
                      <p className="text-[9px] text-slate-600 pl-3.5 capitalize">{task.category}</p>
                    )}
                    {task.due_date && (
                      <p className="text-[9px] text-slate-600 pl-3.5 mt-0.5">📅 {task.due_date}</p>
                    )}

                    {/* Move actions */}
                    <div className="opacity-0 group-hover:opacity-100 mt-2 flex flex-wrap gap-1 transition-all">
                      {nextLanes.map((l) => (
                        <button
                          key={l.key}
                          onClick={() => move(task.id, l.key)}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-[#0d0f14] border border-[#1e2847] text-slate-400 hover:text-white hover:border-indigo-700/50 transition-colors"
                        >
                          → {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {laneTasks.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-[10px] text-slate-700">Empty</p>
                  </div>
                )}
              </div>

              {/* Add card */}
              {lane.key === 'inbox' && (
                <button className="p-2 flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors border-t border-[#1e2847]">
                  <Plus className="w-3 h-3" /> Add task
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
