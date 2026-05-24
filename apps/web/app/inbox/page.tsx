'use client';

import { useEffect, useState, useMemo } from 'react';
import { Inbox, Loader2, AlertCircle, Mail, Calendar, PenLine, Bot, Plus, CheckSquare2 } from 'lucide-react';
import { api, Task } from '@/lib/api';
import { clsx } from 'clsx';

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400 border-red-800/40',
  high: 'bg-orange-500/15 text-orange-400 border-orange-800/40',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-800/40',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-800/40',
};

const SOURCE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  calendar: Calendar,
  manual: PenLine,
  agent: Bot,
};

const FILTERS = ['All', 'Email', 'Calendar', 'Manual', 'Agent'] as const;
type Filter = typeof FILTERS[number];

const SORTS = ['Priority', 'Date', 'Source'] as const;
type Sort = typeof SORTS[number];

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [sort, setSort] = useState<Sort>('Priority');
  const [acting, setActing] = useState<Record<string, 'today' | 'classify'>>({});
  const [classifyingAll, setClassifyingAll] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await api.getTasks('inbox');
      setTasks(data);
    } catch {
      setError('Could not load inbox');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    let list = tasks;
    if (filter !== 'All') {
      const src = filter.toLowerCase();
      list = list.filter(t => t.source === src || (filter === 'Manual' && t.source === 'manual'));
    }
    return [...list].sort((a, b) => {
      if (sort === 'Priority') {
        const order = ['urgent', 'high', 'medium', 'low'];
        return order.indexOf(a.priority) - order.indexOf(b.priority);
      }
      if (sort === 'Date') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return a.source.localeCompare(b.source);
    });
  }, [tasks, filter, sort]);

  const handleAddToday = async (id: string) => {
    setActing(a => ({ ...a, [id]: 'today' }));
    try {
      await api.updateTask(id, { status: 'today' });
      setTasks(ts => ts.filter(t => t.id !== id));
    } finally {
      setActing(a => { const n = { ...a }; delete n[id]; return n; });
    }
  };

  const handleClassify = async (task: Task) => {
    setActing(a => ({ ...a, [task.id]: 'classify' }));
    try {
      await api.runAgent('task_classifier_agent', { text: task.title, title: task.title }, task.id);
      await load();
    } finally {
      setActing(a => { const n = { ...a }; delete n[task.id]; return n; });
    }
  };

  const handleClassifyAll = async () => {
    setClassifyingAll(true);
    for (const task of tasks) {
      await api.runAgent('task_classifier_agent', { text: task.title, title: task.title }, task.id).catch(() => null);
    }
    await load();
    setClassifyingAll(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const task = await api.createTask({ title: newTitle.trim(), status: 'inbox', priority: 'medium' });
      setTasks(ts => [task, ...ts]);
      setNewTitle('');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading inbox…
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p>{error}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Inbox className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Universal Inbox</h1>
          <p className="text-xs text-slate-500">{tasks.length} item{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => void handleClassifyAll()}
            disabled={classifyingAll || tasks.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs text-white font-medium transition-colors"
          >
            {classifyingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            Classify All
          </button>
        </div>
      </div>

      {/* Quick add */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-5">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Add to inbox…"
          className="flex-1 bg-[#131720] border border-[#1e2847] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1a2035] border border-[#1e2847] hover:border-indigo-600/60 rounded-xl text-sm text-slate-300 transition-colors"
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </form>

      {/* Filter + Sort bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-xs transition-all',
                filter === f
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/5',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {SORTS.map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={clsx(
                'px-2 py-1 rounded text-[10px] uppercase tracking-wider transition-all',
                sort === s ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-12 text-center">
            <Inbox className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Your inbox is empty.</p>
            <p className="text-slate-600 text-xs mt-1">Tasks from email, calendar, and manual input will appear here.</p>
          </div>
        ) : (
          filtered.map(task => {
            const SrcIcon = SOURCE_ICON[task.source] ?? PenLine;
            const taskActing = acting[task.id];
            return (
              <div
                key={task.id}
                className="bg-[#131720] border border-[#1e2847] rounded-xl p-3.5 flex items-center gap-3 group hover:border-indigo-800/50 transition-all"
              >
                <SrcIcon className="w-4 h-4 text-slate-600 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>
                  )}
                  <p className="text-[10px] text-slate-700 mt-0.5 capitalize">{task.source}</p>
                </div>

                <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium flex-shrink-0', PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium)}>
                  {task.priority}
                </span>

                {task.due_date && (
                  <span className="text-[10px] text-slate-600 flex-shrink-0">{task.due_date}</span>
                )}

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                  <button
                    onClick={() => void handleAddToday(task.id)}
                    disabled={!!taskActing}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-[10px] hover:bg-emerald-950/70 transition-colors disabled:opacity-50"
                  >
                    {taskActing === 'today' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckSquare2 className="w-3 h-3" />}
                    Today
                  </button>
                  <button
                    onClick={() => void handleClassify(task)}
                    disabled={!!taskActing}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-950/40 border border-indigo-900/40 text-indigo-400 text-[10px] hover:bg-indigo-950/70 transition-colors disabled:opacity-50"
                  >
                    {taskActing === 'classify' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    Classify
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
