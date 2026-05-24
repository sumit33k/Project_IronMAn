'use client';
import { useStore } from '@/stores/useStore';
import { Bot, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

const STATUS_STYLES: Record<string, { dot: string; label: string; bg: string }> = {
  active: { dot: 'bg-emerald-400', label: 'Active', bg: 'text-emerald-400' },
  in_progress: { dot: 'bg-amber-400 animate-pulse', label: 'In Progress', bg: 'text-amber-400' },
  idle: { dot: 'bg-slate-500', label: 'Idle', bg: 'text-slate-500' },
};

interface MockAgent {
  id: string;
  name: string;
  agent_type: string;
  description: string;
}

const MOCK_AGENTS: MockAgent[] = [
  {
    id: 'task_classifier_agent',
    name: 'Chief of Staff',
    agent_type: 'task_classifier',
    description: 'Planning your day and managing priorities.',
  },
  {
    id: 'email_draft_agent',
    name: 'Email Agent',
    agent_type: 'email_draft',
    description: 'Drafting replies and tracking important emails.',
  },
  {
    id: 'presentation_agent',
    name: 'Presentation Agent',
    agent_type: 'presentation',
    description: 'Creating client status deck.',
  },
  {
    id: 'follow_up_agent',
    name: 'Follow-up Agent',
    agent_type: 'follow_up',
    description: 'Tracking pending responses.',
  },
  {
    id: 'calendar_prep_agent',
    name: 'Calendar Agent',
    agent_type: 'calendar_prep',
    description: 'Managing your schedule and focus time.',
  },
];

export default function AgentWorkbench() {
  const { agents } = useStore();

  const displayAgents = agents.length > 0 ? agents.slice(0, 5) : MOCK_AGENTS;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-400" />
          Agent Workbench
        </h2>
        <Link href="/agents" className="text-xs text-indigo-400 hover:text-indigo-300">
          View All Agents
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {displayAgents.map((agent, i) => {
          const statusKey = i === 2 ? 'in_progress' : 'active';
          const s = STATUS_STYLES[statusKey];
          return (
            <div
              key={agent.id}
              className="bg-[#1a2035] rounded-xl p-3 border border-[#1e2847] hover:border-indigo-800/60 transition-all"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
                <span className={clsx('text-[10px] font-medium', s.bg)}>{s.label}</span>
              </div>
              <p className="text-xs font-semibold text-white mb-1 leading-tight">{agent.name}</p>
              <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">
                {agent.description}
              </p>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                <span>Ready</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
