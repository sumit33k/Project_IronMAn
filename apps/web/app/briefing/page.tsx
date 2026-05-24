'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/stores/useStore';
import { api, Briefing } from '@/lib/api';
import { Sparkles, RefreshCw, Loader2, TrendingUp, AlertTriangle, Calendar, Clock } from 'lucide-react';

export default function BriefingPage() {
  const { briefing, loadBriefing, ollamaAvailable } = useStore();
  const [generating, setGenerating] = useState(false);
  const [meetings, setMeetings] = useState('');
  const [followUps, setFollowUps] = useState('');

  useEffect(() => { void loadBriefing(); }, [loadBriefing]);

  const generate = async () => {
    setGenerating(true);
    try {
      const mList = meetings.split('\n').map((s) => s.trim()).filter(Boolean);
      const fList = followUps.split('\n').map((s) => s.trim()).filter(Boolean);
      await api.generateBriefing(mList, fList);
      await loadBriefing();
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const b = briefing;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            Daily Briefing
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {b ? `Generated for ${b.date}` : 'Your AI-generated command briefing'}
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-xl text-sm text-white font-medium transition-colors"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {generating ? 'Generating…' : 'Generate Brief'}
        </button>
      </div>

      {!ollamaAvailable && (
        <div className="glass-card p-3 border-amber-800/40 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400">Ollama is offline. Run <code className="font-mono bg-[#0d0f14] px-1 rounded">ollama serve</code> then retry.</p>
        </div>
      )}

      {/* Input context */}
      {!b && (
        <div className="glass-card p-4 mb-6">
          <h2 className="text-sm font-semibold text-white mb-3">Provide Context (optional)</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-400 mb-1 block">Upcoming meetings (one per line)</span>
              <textarea
                value={meetings}
                onChange={(e) => setMeetings(e.target.value)}
                rows={3}
                className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                placeholder="10:00 AM Product Sync&#10;2:00 PM 1:1 with manager"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400 mb-1 block">Pending follow-ups (one per line)</span>
              <textarea
                value={followUps}
                onChange={(e) => setFollowUps(e.target.value)}
                rows={3}
                className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                placeholder="Reply to vendor quote&#10;Follow up with Raj"
              />
            </label>
          </div>
        </div>
      )}

      {/* Briefing content */}
      {b ? (
        <div className="space-y-4">
          {/* Summary + score */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-white mb-2">Summary</h2>
                <p className="text-sm text-slate-300 leading-relaxed">{b.summary}</p>
              </div>
              <div className="flex-shrink-0 flex flex-col items-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Focus Score</p>
                <div className="relative w-16 h-16">
                  <svg viewBox="0 0 64 64" className="w-full h-full">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#1e2847" strokeWidth="5" />
                    <circle cx="32" cy="32" r="26" fill="none"
                      stroke={b.focus_score >= 80 ? '#10b981' : b.focus_score >= 60 ? '#06b6d4' : '#f59e0b'}
                      strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={`${(b.focus_score / 100) * 163} 163`}
                      transform="rotate(-90 32 32)" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{b.focus_score}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400">
                    {b.focus_score >= 80 ? 'Excellent' : b.focus_score >= 60 ? 'Good' : 'Fair'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'Top Priorities', items: b.top_priorities,     icon: '🎯', color: 'text-red-400' },
              { title: 'Meetings to Prep', items: b.meetings_to_prepare, icon: '📅', color: 'text-blue-400' },
              { title: 'Urgent Follow-ups', items: b.urgent_followups, icon: '⚡', color: 'text-amber-400' },
              { title: 'Risks',            items: b.risks,             icon: '⚠️', color: 'text-orange-400' },
              { title: 'Tasks to Delegate', items: b.tasks_to_delegate, icon: '🤖', color: 'text-purple-400' },
              { title: 'Recommended Schedule', items: b.recommended_schedule, icon: '🗓', color: 'text-emerald-400' },
            ].map(({ title, items, icon, color }) => items.length > 0 && (
              <div key={title} className="glass-card p-4">
                <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
                  <span>{icon}</span>
                  <span className={color}>{title}</span>
                </h3>
                <ul className="space-y-1">
                  {items.map((item, i) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <Sparkles className="w-10 h-10 text-purple-400/40 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No briefing generated yet.</p>
          <p className="text-slate-600 text-xs mt-1">Click &quot;Generate Brief&quot; above to create your daily briefing.</p>
        </div>
      )}
    </div>
  );
}
