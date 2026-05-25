'use client';

import { Sparkles, ChevronRight } from 'lucide-react';
import { useStore } from '@/stores/useStore';

const TYPE_STYLES: Record<string, { color: string; bg: string }> = {
  warning: { color: 'text-amber-400',   bg: 'bg-amber-950/40' },
  tip:     { color: 'text-purple-400',  bg: 'bg-purple-950/40' },
  info:    { color: 'text-blue-400',    bg: 'bg-blue-950/40' },
};

const FALLBACK_STYLE = { color: 'text-indigo-400', bg: 'bg-indigo-950/40' };

export default function AISuggestions() {
  const { aiSuggestions } = useStore();

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          AI Suggestions
        </h2>
      </div>

      <div className="space-y-2">
        {aiSuggestions.length === 0 ? (
          <div className="rounded-lg p-3 border border-[#1e2847] bg-[#1a2035] text-center">
            <p className="text-xs text-slate-500 italic">No suggestions right now.</p>
          </div>
        ) : (
          aiSuggestions.map((s, i) => {
            const style = TYPE_STYLES[s.type ?? ''] ?? FALLBACK_STYLE;
            return (
              <div key={i} className={`rounded-lg p-3 border border-[#1e2847] ${style.bg}`}>
                <div className="flex items-start gap-2 mb-2">
                  <Sparkles className={`w-3 h-3 flex-shrink-0 mt-0.5 ${style.color}`} />
                  <p className="text-xs text-slate-300 leading-relaxed">{s.text}</p>
                </div>
                {s.action && (
                  <button
                    className={`text-[10px] font-medium flex items-center gap-1 transition-colors ${style.color} hover:opacity-80`}
                  >
                    {s.action} <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
