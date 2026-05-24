'use client';

import { Sparkles, ChevronRight } from 'lucide-react';

const SUGGESTIONS = [
  {
    text: 'You usually work on presentations in the morning. Consider starting the deck now.',
    action: 'Start Presentation Agent',
    color: 'text-purple-400',
    bg: 'bg-purple-950/40',
  },
  {
    text: 'You have 3 unanswered emails from important contacts.',
    action: 'Review Emails',
    color: 'text-blue-400',
    bg: 'bg-blue-950/40',
  },
  {
    text: 'Based on your calendar, you can focus better between 2–4 PM.',
    action: 'Start Focus Session',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40',
  },
];

export default function AISuggestions() {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          AI Suggestions
        </h2>
        <button className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">
          View All
        </button>
      </div>

      <div className="space-y-2">
        {SUGGESTIONS.map((s, i) => (
          <div key={i} className={`rounded-lg p-3 border border-[#1e2847] ${s.bg}`}>
            <div className="flex items-start gap-2 mb-2">
              <Sparkles className={`w-3 h-3 flex-shrink-0 mt-0.5 ${s.color}`} />
              <p className="text-xs text-slate-300 leading-relaxed">{s.text}</p>
            </div>
            <button
              className={`text-[10px] font-medium flex items-center gap-1 transition-colors ${s.color} hover:opacity-80`}
            >
              {s.action} <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
