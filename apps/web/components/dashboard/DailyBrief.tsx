'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw, TrendingUp } from 'lucide-react';
import { useStore } from '@/stores/useStore';
import { api } from '@/lib/api';

export default function DailyBrief() {
  const { briefing, loadBriefing, ollamaAvailable } = useStore();
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      await api.generateBriefing([], []);
      await loadBriefing();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const score = briefing?.focus_score ?? 78;
  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#06b6d4' : '#f59e0b';
  const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Fair';
  const circumference = 2 * Math.PI * 26;
  const dash = (score / 100) * circumference;

  const bulletPoints = briefing
    ? briefing.top_priorities.slice(0, 3)
    : [
        'You have a client meeting at 11:00 AM.',
        'The Infoblox proposal requires your review.',
        '3 emails need your response.',
        'Your focus time is blocked between 2:00 – 4:00 PM.',
      ];

  const dotColors = ['bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-purple-400'];

  return (
    <div className="glass-card p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          AI Daily Brief
        </h2>
        <button
          onClick={generate}
          disabled={loading}
          className="text-slate-500 hover:text-indigo-400 transition-colors"
          title="Regenerate brief"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-1.5 flex-1">
        {bulletPoints.map((point, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[i] ?? 'bg-slate-400'}`} />
            {point}
          </div>
        ))}
      </div>

      {briefing && (
        <button className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors text-left">
          View Full Brief →
        </button>
      )}

      {/* Focus Score */}
      <div className="mt-3 pt-3 border-t border-[#1e2847] flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Focus Score</p>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-white">{score}</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mb-1" />
          </div>
          <span className="text-[10px] font-medium" style={{ color: scoreColor }}>{scoreLabel}</span>
          <p className="text-[9px] text-slate-600 mt-0.5">Trending up by 12% ↑</p>
        </div>
        <svg className="w-16 h-16 flex-shrink-0" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="#1e2847" strokeWidth="5" />
          <circle
            cx="32" cy="32" r="26" fill="none"
            stroke={scoreColor} strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 32 32)"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
      </div>

      {!ollamaAvailable && (
        <p className="mt-2 text-[10px] text-amber-400/80 bg-amber-950/30 rounded px-2 py-1">
          Ollama offline — run <code className="font-mono">ollama serve</code>
        </p>
      )}
    </div>
  );
}
