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

const MOCK = [
  {
    id: 'task_classifier_agent',
    name: 'Chief of Staff',
    agent_type: 'task_classifier',
    description: 'Planning your day and managing priorities.',
    statusKey: 'active',
    statA: '6 tasks',
    statB: '2 done',
    icon: '🧑‍💼',
  },
  {
    id: 'email_draft_agent',
    name: 'Email Agent',
    agent_type: 'email_draft',
    description: 'Drafting replies and tracking important emails.',
    statusKey: 'active',
    statA: '3 drafts',
    statB: '1 awaiting',
    icon: '✉️',
  },
  {
    id: 'presentation_agent',
    name: 'Presentation Agent',
    agent_type: 'presentation',
    description: 'Creating client status deck.',
    statusKey: 'in_progress',
    statA: '1 task',
    statB: 'In review',
    icon: '📊',
  },
  {
    id: 'follow_up_agent',
    name: 'Follow-up Agent',
    agent_type: 'follow_up',
    description: 'Tracking pending responses.',
    statusKey: 'active',
    statA: '7 pending',
    statB: '2 overdue',
    icon: '🔄',
  },
  {
    id: 'calendar_prep_agent',
    name: 'Calendar Agent',
    agent_type: 'calendar_prep',
    description: 'Managing your schedule and focus time.',
    statusKey: 'active',
    statA: '3 events',
    statB: '1 conflict',
    icon: '📅',
  },
];

export default function AgentWorkbench() {
  const { agents } = useStore();

  const items = agents.length > 0
    ? agents.slice(0, 5).map((a, i) => ({
        ...a,
        statusKey: i === 2 ? 'in_progress' : 'active',
        statA: MOCK[i]?.statA ?? 'Ready',
        statB: MOCK[i]?.statB ?? '',
        icon: MOCK[i]?.icon ?? '🤖',
      }))
    : MOCK;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-400" />
          Agent Workbench
        </h2>
        <Link href="/agents" className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">
          View All Agents
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((agent) => {
          const s = STATUS[agent.statusKey] ?? STATUS.idle;
          return (
            <div
              key={agent.id}
              className="bg-[#1a2035] rounded-xl p-3 border border-[#1e2847] hover:border-indigo-700/60 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-base leading-none">{agent.icon}</span>
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
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-400 bg-[#0d1020] rounded px-1.5 py-0.5">{agent.statA}</span>
                {agent.statB && (
                  <span className="text-[10px] text-slate-500 bg-[#0d1020] rounded px-1.5 py-0.5">{agent.statB}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
