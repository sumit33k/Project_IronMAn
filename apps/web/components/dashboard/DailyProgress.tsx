'use client';

import { useStore } from '@/stores/useStore';
import { Zap } from 'lucide-react';
import Link from 'next/link';

const METRICS = [
  { label: 'Tasks Completed', value: '8/12',      icon: '✓' },
  { label: 'Focus Time',      value: '3.2 / 4 hrs', icon: '⏱' },
  { label: 'Emails Cleared',  value: '15/28',     icon: '✉' },
  { label: 'Follow-ups Done', value: '3/7',       icon: '↩' },
];

export default function DailyProgress() {
  const { tasks } = useStore();
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = Math.max(tasks.length, 1);
  const pct = Math.min(Math.round((completed / total) * 100), 100);

  const circumference = 2 * Math.PI * 26;
  const dash = (pct / 100) * circumference;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          Daily Progress
        </h2>
        <Link href="/analytics" className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">
          View Analytics
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-full h-full" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="#1e2847" strokeWidth="5" />
            <circle
              cx="32" cy="32" r="26" fill="none"
              stroke="#10b981" strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-white">{pct}%</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-white">Day Progress</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {completed} of {total} tasks done
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {METRICS.map((m) => (
          <div key={m.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="text-slate-600 w-3">{m.icon}</span>
              {m.label}
            </span>
            <span className="text-white font-medium tabular-nums">{m.value}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-yellow-500/70 italic text-center">
        ⚡ Discipline today, freedom tomorrow.
      </p>
    </div>
  );
}
