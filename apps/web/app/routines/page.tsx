'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Loader2, Plus, Flame, Clock, Trash2, X, Check } from 'lucide-react';
import { api, Routine } from '@/lib/api';
import { clsx } from 'clsx';

const FREQUENCIES = ['daily', 'weekly', 'weekdays'] as const;
type Frequency = typeof FREQUENCIES[number];

const CATEGORIES = ['health', 'work', 'learning', 'mindfulness', 'fitness', 'personal', 'other'] as const;

const FREQ_COLORS: Record<string, string> = {
  daily: 'bg-indigo-500/15 text-indigo-400 border-indigo-800/40',
  weekly: 'bg-purple-500/15 text-purple-400 border-purple-800/40',
  weekdays: 'bg-blue-500/15 text-blue-400 border-blue-800/40',
};

function isCompletedToday(routine: Routine): boolean {
  if (!routine.last_completed) return false;
  const today = new Date().toISOString().split('T')[0];
  return routine.last_completed.startsWith(today);
}

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [targetTime, setTargetTime] = useState('');
  const [duration, setDuration] = useState('');
  const [category, setCategory] = useState('personal');

  const load = async () => {
    try {
      const data = await api.getRoutines();
      setRoutines(data);
    } catch {
      setError('Could not load routines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const activeRoutines = routines.filter(r => r.active);
  const completedToday = activeRoutines.filter(isCompletedToday);
  const score = activeRoutines.length > 0
    ? Math.round((completedToday.length / activeRoutines.length) * 100)
    : 0;

  const handleComplete = async (id: string) => {
    setCompleting(c => ({ ...c, [id]: true }));
    try {
      const res = await api.completeRoutine(id);
      setRoutines(rs => rs.map(r => r.id === id
        ? { ...r, streak: res.streak, last_completed: new Date().toISOString() }
        : r
      ));
    } catch {
      // ignore
    } finally {
      setCompleting(c => { const n = { ...c }; delete n[id]; return n; });
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(d => ({ ...d, [id]: true }));
    try {
      await api.deleteRoutine(id);
      setRoutines(rs => rs.filter(r => r.id !== id));
    } catch {
      setDeleting(d => { const n = { ...d }; delete n[id]; return n; });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const routine = await api.createRoutine({
        name: name.trim(),
        frequency,
        target_time: targetTime || undefined,
        duration_minutes: duration ? parseInt(duration) : undefined,
        category,
      });
      setRoutines(rs => [routine, ...rs]);
      setName('');
      setFrequency('daily');
      setTargetTime('');
      setDuration('');
      setCategory('personal');
      setShowForm(false);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading routines…
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
      <p className="text-red-400">{error}</p>
      <button onClick={() => void load()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium">Retry</button>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <RotateCcw className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Routines</h1>
          <p className="text-xs text-slate-500">{activeRoutines.length} active · {completedToday.length} done today</p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Routine'}
        </button>
      </div>

      {/* Today's Score */}
      {activeRoutines.length > 0 && (
        <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Today&apos;s Score</p>
            <span className={clsx(
              'text-lg font-bold',
              score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-yellow-400' : 'text-slate-400'
            )}>
              {score}%
            </span>
          </div>
          <div className="w-full bg-[#1a2035] rounded-full h-2">
            <div
              className={clsx(
                'h-2 rounded-full transition-all duration-500',
                score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-yellow-500' : 'bg-indigo-500'
              )}
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {completedToday.length} of {activeRoutines.length} routines completed today
          </p>
        </div>
      )}

      {/* Add routine form */}
      {showForm && (
        <form
          onSubmit={e => void handleCreate(e)}
          className="bg-[#131720] border border-indigo-800/40 rounded-2xl p-5 mb-5 space-y-4"
        >
          <p className="text-sm font-semibold text-white">New Routine</p>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Morning workout, meditation, review inbox…"
              required
              className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Frequency</label>
              <div className="flex gap-1.5 flex-wrap">
                {FREQUENCIES.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all',
                      frequency === f ? 'bg-indigo-600 text-white' : 'bg-[#1a2035] border border-[#1e2847] text-slate-400 hover:text-white'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="bg-[#1a2035] capitalize">{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Target Time</label>
              <input
                type="time"
                value={targetTime}
                onChange={e => setTargetTime(e.target.value)}
                className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Duration (minutes)</label>
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="30"
                min="1"
                className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? 'Creating…' : 'Create Routine'}
          </button>
        </form>
      )}

      {/* Routines list */}
      <div className="space-y-2">
        {routines.length === 0 ? (
          <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-12 text-center">
            <RotateCcw className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No routines yet.</p>
            <p className="text-slate-600 text-xs mt-1">Build consistent habits by adding your first routine.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium"
            >
              Add First Routine
            </button>
          </div>
        ) : (
          routines.map(routine => {
            const done = isCompletedToday(routine);
            return (
              <div
                key={routine.id}
                className={clsx(
                  'bg-[#131720] border rounded-xl p-4 flex items-center gap-3 group transition-all',
                  done ? 'border-emerald-800/40 opacity-75' : 'border-[#1e2847] hover:border-indigo-800/50'
                )}
              >
                {/* Complete checkbox */}
                <button
                  onClick={() => !done && void handleComplete(routine.id)}
                  disabled={completing[routine.id] || done}
                  className={clsx(
                    'w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all',
                    done
                      ? 'border-emerald-600 bg-emerald-600/20'
                      : 'border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/10'
                  )}
                >
                  {completing[routine.id] ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  ) : done ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : null}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={clsx('text-sm font-medium truncate', done ? 'text-slate-500 line-through' : 'text-white')}>
                      {routine.name}
                    </p>
                    <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium flex-shrink-0', FREQ_COLORS[routine.frequency] ?? FREQ_COLORS.daily)}>
                      {routine.frequency}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {routine.target_time && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {routine.target_time}
                      </span>
                    )}
                    {routine.duration_minutes > 0 && (
                      <span className="text-[10px] text-slate-600">{routine.duration_minutes}m</span>
                    )}
                    <span className="text-[10px] text-slate-600 capitalize">{routine.category}</span>
                    {routine.last_completed && (
                      <span className="text-[10px] text-slate-700">
                        Last: {new Date(routine.last_completed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Streak */}
                {routine.streak > 0 && (
                  <div className="flex items-center gap-1 text-orange-400 flex-shrink-0">
                    <Flame className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">{routine.streak}</span>
                  </div>
                )}

                {/* Delete */}
                <button
                  onClick={() => void handleDelete(routine.id)}
                  disabled={deleting[routine.id]}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                >
                  {deleting[routine.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
