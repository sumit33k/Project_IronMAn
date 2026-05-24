'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCircle2, ArrowDownRight, ChevronRight, Loader2 } from 'lucide-react';
import { api, Task } from '@/lib/api';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400 border-red-800/40',
  high: 'bg-orange-500/15 text-orange-400 border-orange-800/40',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-800/40',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-800/40',
};

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function FocusPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<'complete' | 'defer' | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const load = async () => {
      const [urgent, high] = await Promise.all([
        api.getTasks('today').catch(() => []),
        api.getTasks('in_progress').catch(() => []),
      ]);
      const all = [...(urgent as Task[]), ...(high as Task[])].filter(
        t => ['urgent', 'high', 'critical'].includes(t.priority) && t.status !== 'done'
      );
      const sorted = all.sort((a, b) => {
        const order = ['urgent', 'critical', 'high'];
        return order.indexOf(a.priority) - order.indexOf(b.priority);
      });
      setTasks(sorted);
      setLoading(false);
    };
    void load();
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleComplete = useCallback(async () => {
    if (acting || !tasks[current]) return;
    setActing('complete');
    try {
      await api.completeTask(tasks[current].id);
      if (current + 1 >= tasks.length) {
        setDone(true);
      } else {
        setCurrent(c => c + 1);
      }
    } finally {
      setActing(null);
    }
  }, [acting, tasks, current]);

  const handleDefer = useCallback(async () => {
    if (acting || !tasks[current]) return;
    setActing('defer');
    try {
      await api.deferTask(tasks[current].id);
      if (current + 1 >= tasks.length) {
        setDone(true);
      } else {
        setCurrent(c => c + 1);
      }
    } finally {
      setActing(null);
    }
  }, [acting, tasks, current]);

  const handleNext = useCallback(() => {
    if (current + 1 >= tasks.length) {
      setDone(true);
    } else {
      setCurrent(c => c + 1);
    }
  }, [current, tasks.length]);

  if (loading) return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#050608] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 pt-6 pb-2">
        <div>
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Focus Mode</p>
          <p className="text-2xl font-mono text-white tracking-wider">{formatTime(elapsed)}</p>
        </div>
        {!done && (
          <p className="text-xs text-slate-500 font-mono">
            {tasks.length - current} task{tasks.length - current !== 1 ? 's' : ''} remaining
          </p>
        )}
        <button
          onClick={() => router.push('/')}
          className="w-9 h-9 rounded-lg bg-[#131720] border border-[#1e2847] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-8">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="flex justify-center gap-1 mb-6">
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-indigo-400"
                    animate={{ y: [0, -20, 0], opacity: [1, 0.5, 1] }}
                    transition={{ delay: i * 0.08, duration: 0.6, repeat: Infinity }}
                  />
                ))}
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">All done! 🎉</h2>
              <p className="text-slate-400 text-sm mb-1">Focus session: {formatTime(elapsed)}</p>
              <p className="text-slate-600 text-xs mb-8">Great work. Take a break.</p>
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm text-white font-medium transition-colors"
              >
                Exit Focus Mode
              </button>
            </motion.div>
          ) : tasks.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <p className="text-slate-400 text-lg mb-2">No priority tasks for today.</p>
              <p className="text-slate-600 text-sm mb-6">Add urgent or high-priority tasks to your today queue.</p>
              <button onClick={() => router.push('/today')} className="text-indigo-400 text-sm hover:underline">
                Go to Today →
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={tasks[current]?.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-xl"
            >
              <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full border capitalize font-medium', PRIORITY_STYLES[tasks[current].priority] ?? PRIORITY_STYLES.medium)}>
                    {tasks[current].priority}
                  </span>
                  {tasks[current].due_date && (
                    <span className="text-xs text-slate-500">Due {tasks[current].due_date}</span>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-white leading-snug mb-3">{tasks[current].title}</h2>

                {tasks[current].next_action && (
                  <div className="flex items-start gap-2 mb-4">
                    <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-300">{tasks[current].next_action}</p>
                  </div>
                )}

                {tasks[current].description && (
                  <p className="text-sm text-slate-500 mb-6 line-clamp-2">{tasks[current].description}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => void handleComplete()}
                    disabled={!!acting}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-xl text-sm text-white font-medium transition-colors"
                  >
                    {acting === 'complete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Complete
                  </button>
                  <button
                    onClick={() => void handleDefer()}
                    disabled={!!acting}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-600/80 hover:bg-amber-600 disabled:opacity-60 rounded-xl text-sm text-white font-medium transition-colors"
                  >
                    {acting === 'defer' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownRight className="w-4 h-4" />}
                    Defer
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!!acting}
                    className="px-4 py-3 bg-[#1a2035] hover:bg-[#1e2847] rounded-xl text-sm text-slate-400 font-medium transition-colors"
                  >
                    Skip →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dots */}
      {!done && tasks.length > 0 && (
        <div className="flex justify-center gap-2 pb-8">
          {tasks.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={clsx(
                'w-2 h-2 rounded-full transition-all',
                i === current ? 'bg-indigo-400 w-5' : i < current ? 'bg-emerald-600' : 'bg-[#1e2847]',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
