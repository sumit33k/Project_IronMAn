'use client';

import { useEffect, useState } from 'react';
import { Moon, Loader2, AlertCircle, ChevronRight, Sparkles } from 'lucide-react';
import { api, EodReview } from '@/lib/api';
import { clsx } from 'clsx';

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-yellow-400', low: 'bg-emerald-400',
};

function MomentumRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171';

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="144" height="144">
        <circle cx="72" cy="72" r={radius} strokeWidth="8" stroke="#1e2847" fill="none" />
        <circle
          cx="72" cy="72" r={radius} strokeWidth="8" stroke={color} fill="none"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="text-center">
        <p className="text-3xl font-bold text-white">{pct}%</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">momentum</p>
      </div>
    </div>
  );
}

function TaskList({ tasks, variant = 'normal' }: {
  tasks: { title: string; priority: string }[];
  variant?: 'normal' | 'danger';
}) {
  if (tasks.length === 0) return <p className="text-xs text-slate-600">None</p>;
  return (
    <ul className="space-y-1.5">
      {tasks.map((t, i) => (
        <li key={i} className="flex items-center gap-2 text-xs">
          <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.medium)} />
          <span className={variant === 'danger' ? 'text-red-300' : 'text-slate-300'}>{t.title}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReviewPage() {
  const [review, setReview] = useState<EodReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const load = async () => {
    try {
      const data = await api.getEodReview();
      setReview(data);
    } catch {
      setError('Could not load review — is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleGenerate = async (withNotes = false) => {
    setGenerating(true);
    try {
      const data = await api.generateEodReview(withNotes ? notes : undefined);
      setReview(data);
    } catch {
      setError('Failed to generate review');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading review…
    </div>
  );

  if (error && !review) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p>{error}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Moon className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">End-of-Day Review</h1>
          <p className="text-xs text-slate-500">{review?.date ?? new Date().toISOString().slice(0, 10)}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => void handleGenerate(false)}
            disabled={generating}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#131720] border border-[#1e2847] hover:border-indigo-600/60 rounded-lg text-xs text-slate-300 transition-all"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
            Regenerate
          </button>
        </div>
      </div>

      {review && (
        <>
          {/* Momentum + summary row */}
          <div className="flex flex-col sm:flex-row gap-5 mb-6">
            <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5 flex items-center justify-center">
              <MomentumRing score={review.momentum_score} />
            </div>

            <div className="flex-1 bg-[#131720] border border-[#1e2847] rounded-2xl p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">AI Summary</p>
              {review.summary === 'Ollama unavailable — manual review needed' ? (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-300">AI summary unavailable — Ollama not running</p>
                </div>
              ) : (
                <p className="text-sm text-slate-300 leading-relaxed">{review.summary}</p>
              )}
            </div>
          </div>

          {/* 4-panel grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-[#131720] border border-[#1e2847] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-emerald-400">✅</span>
                <p className="text-xs font-semibold text-white">Completed <span className="text-slate-500 font-normal">({review.completed_count})</span></p>
              </div>
              <TaskList tasks={review.completed_tasks} />
            </div>

            <div className="bg-[#131720] border border-[#1e2847] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-400">⏭</span>
                <p className="text-xs font-semibold text-white">Deferred <span className="text-slate-500 font-normal">({review.deferred_count})</span></p>
              </div>
              <TaskList tasks={review.deferred_tasks} />
            </div>

            <div className="bg-[#131720] border border-red-900/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red-400">⚠️</span>
                <p className="text-xs font-semibold text-white">Missed <span className="text-red-400/60 font-normal">({review.missed_count})</span></p>
              </div>
              <TaskList tasks={review.missed_tasks} variant="danger" />
            </div>

            <div className="bg-[#131720] border border-[#1e2847] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-indigo-400">📅</span>
                <p className="text-xs font-semibold text-white">Tomorrow&apos;s Queue</p>
              </div>
              <TaskList tasks={review.tomorrow_queue} />
            </div>
          </div>

          {/* AI suggestions row */}
          {(review.recommended_actions.length > 0 || review.delegation_opportunities.length > 0 || review.follow_ups_needed.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Section title="Recommended Actions" items={review.recommended_actions} accent="indigo" />
              <Section title="Delegation Opportunities" items={review.delegation_opportunities} accent="amber" />
              <Section title="Follow-ups Needed" items={review.follow_ups_needed} accent="sky" />
            </div>
          )}

          {/* Notes + regenerate */}
          <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Generate with Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add context about your day…"
              rows={3}
              className="w-full bg-[#0d0f14] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none mb-3"
            />
            <button
              onClick={() => void handleGenerate(true)}
              disabled={generating || !notes.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs text-white font-medium transition-colors"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Generate with Notes
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  const accentMap: Record<string, string> = {
    indigo: 'text-indigo-400', amber: 'text-amber-400', sky: 'text-sky-400',
  };
  return (
    <div className="bg-[#131720] border border-[#1e2847] rounded-xl p-4">
      <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${accentMap[accent]}`}>{title}</p>
      {items.length === 0
        ? <p className="text-xs text-slate-600">None</p>
        : (
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
