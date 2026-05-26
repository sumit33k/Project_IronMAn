'use client';
import { useStore } from '@/stores/useStore';
import { Bot } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

const STATUS: Record<string, { dot: string; label: string; color: string }> = {
  active:      { dot: 'bg-emerald-400',             label: 'Active',      color: 'text-emerald-400' },
  in_progress: { dot: 'bg-amber-400 animate-pulse', label: 'In Progress', color: 'text-amber-400'   },
  idle:        { dot: 'bg-slate-500',               label: 'Idle',        color: 'text-slate-500'   },
};

export default function AgentWorkbench() {
  const { agents } = useStore();

  const header = (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <Bot className="w-4 h-4 text-purple-400" />
        Agent Workbench
      </h2>
      <Link href="/agents" className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">
        View All Agents
      </Link>
    </div>
  );

  if (agents.length === 0) {
    return (
      <div className="glass-card p-4">
        {header}
        <p className="text-xs text-slate-500 text-center py-6">No agents registered.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      {header}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {agents.slice(0, 5).map((agent) => {
          const s = STATUS.idle;
          return (
            <div
              key={agent.id}
              className="bg-[#1a2035] rounded-xl p-3 border border-[#1e2847] hover:border-indigo-700/60 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <Bot className="w-4 h-4 text-slate-500" />
                <span className={clsx('flex items-center gap-1 text-[10px] font-medium', s.color)}>
                  <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
                  {s.label}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-white mb-1 leading-snug group-hover:text-indigo-200 transition-colors">
                {agent.name}
              </p>
              <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2 mb-2">
                {agent.description}
              </p>
              <span className="text-[10px] text-slate-500 bg-[#0d1020] rounded px-1.5 py-0.5 capitalize">
                {agent.risk_level} risk
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
