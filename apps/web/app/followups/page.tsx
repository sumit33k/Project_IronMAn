'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Loader2, CheckCircle2, Clock, AlertCircle, Inbox } from 'lucide-react';
import { api, Task } from '@/lib/api';
import { clsx } from 'clsx';

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-800/40',
  high: 'bg-orange-500/15 text-orange-400 border-orange-800/40',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-800/40',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-800/40',
};

const TABS = ['Waiting', 'Stale'] as const;
type Tab = typeof TABS[number];

export default function FollowUpsPage() {
  const [tab, setTab] = useState<Tab>('Waiting');
  const [waitingTasks, setWaitingTasks] = useState<Task[]>([]);
  const [staleTasks, setStaleTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentLoading, setAgentLoading] = useState(false);
  const [acting, setActing] = useState<Record<string, 'done' | 'snooze'>>({});
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const waiting = await api.getTasks('waiting');
      setWaitingTasks(waiting);

      setAgentLoading(true);
      try {
        const run = await api.runAgent('follow_up_agent', {});
        const out = run.output_data ?? {};
        const staleList = (out.stale_tasks as Task[] | undefined) ?? [];
        setStaleTasks(staleList);
      } catch {
        // Agent may not exist — fall back to tasks updated 3+ days ago
        const todayTasks = await api.getTasks('today').catch(() => [] as Task[]);
        const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
        setStaleTasks(todayTasks.filter(t => new Date(t.updated_at).getTime() < cutoff));
      } finally {
        setAgentLoading(false);
      }
    } catch {
      setError('Could not load follow-ups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleDone = async (id: string) => {
    setActing(a => ({ ...a, [id]: 'done' }));
    try {
      await api.completeTask(id);
      setWaitingTasks(ts => ts.filter(t => t.id !== id));
      setStaleTasks(ts => ts.filter(t => t.id !== id));
    } finally {
      setActing(a => { const n = { ...a }; delete n[id]; return n; });
    }
  };

  const handleSnooze = async (id: string) => {
    setActing(a => ({ ...a, [id]: 'snooze' }));
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    try {
      await api.deferTask(id, tomorrow);
      setWaitingTasks(ts => ts.filter(t => t.id !== id));
      setStaleTasks(ts => ts.filter(t => t.id !== id));
    } finally {
      setActing(a => { const n = { ...a }; delete n[id]; return n; });
    }
  };

  const displayTasks = tab === 'Waiting' ? waitingTasks : staleTasks;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const daysSince = (dateStr: string) =>
    Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading follow-ups…
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p>{error}</p>
      <button onClick={() => void load()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium">
        Retry
      </button>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <RefreshCw className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Follow-Ups</h1>
          <p className="text-xs text-slate-500">
            {waitingTasks.length} waiting · {staleTasks.length} stale
            {agentLoading && <span className="ml-2 text-indigo-400">Analyzing with Jarvis…</span>}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="ml-auto px-3 py-1.5 bg-[#1a2035] border border-[#1e2847] hover:border-indigo-600/60 rounded-lg text-xs text-slate-300 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#131720] border border-[#1e2847] rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            {t}
            <span className={clsx(
              'ml-2 text-[10px] px-1.5 py-0.5 rounded-full',
              tab === t ? 'bg-white/20' : 'bg-[#1e2847] text-slate-500'
            )}>
              {t === 'Waiting' ? waitingTasks.length : staleTasks.length}
            </span>
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {displayTasks.length === 0 ? (
          <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-12 text-center">
            <Inbox className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {tab === 'Waiting' ? 'No waiting tasks right now.' : 'No stale tasks detected.'}
            </p>
            <p className="text-slate-600 text-xs mt-1">
              {tab === 'Waiting'
                ? "Tasks you're waiting on others for will appear here."
                : 'Tasks untouched for 3+ days will appear here.'}
            </p>
          </div>
        ) : (
          displayTasks.map(task => {
            const a = acting[task.id];
            const days = daysSince(task.updated_at);
            return (
              <div
                key={task.id}
                className="bg-[#131720] border border-[#1e2847] rounded-xl p-4 flex items-center gap-3 group hover:border-indigo-800/50 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-slate-600 capitalize">{task.category || task.source}</span>
                    {tab === 'Stale' && (
                      <span className="text-[10px] text-amber-500/70 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {days}d untouched
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-[10px] text-slate-600">Due {formatDate(task.due_date)}</span>
                    )}
                  </div>
                </div>

                <span className={clsx(
                  'text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium flex-shrink-0',
                  PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium
                )}>
                  {task.priority}
                </span>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => void handleDone(task.id)}
                    disabled={!!a}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-[10px] hover:bg-emerald-950/70 transition-colors disabled:opacity-50"
                  >
                    {a === 'done' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Done
                  </button>
                  <button
                    onClick={() => void handleSnooze(task.id)}
                    disabled={!!a}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/40 border border-slate-700/40 text-slate-400 text-[10px] hover:bg-slate-800/70 transition-colors disabled:opacity-50"
                  >
                    {a === 'snooze' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                    Snooze
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
