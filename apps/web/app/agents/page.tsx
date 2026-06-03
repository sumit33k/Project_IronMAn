'use client';

import { useEffect, useState } from 'react';
import { api, type AgentInfo, type AgentRun } from '@/lib/api';
import {
  Bot, Play, Loader2, CheckCircle, XCircle, Clock,
  AlertTriangle, Power, FileText, Mic,
} from 'lucide-react';
import { clsx } from 'clsx';

const RISK_STYLES: Record<string, string> = {
  low:    'bg-emerald-950/50 text-emerald-400 border-emerald-800/30',
  medium: 'bg-amber-950/50  text-amber-400  border-amber-800/30',
  high:   'bg-red-950/50    text-red-400    border-red-800/30',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<{ agentId: string; data: unknown } | null>(null);

  const reload = () => {
    api.getAgents().then(setAgents).catch(console.error);
    api.getAgentRuns().then(setRuns).catch(console.error);
  };

  useEffect(() => { reload(); }, []);

  const runAgent = async (agentId: string) => {
    setRunning(agentId);
    setLastOutput(null);
    try {
      const run = await api.runAgent(agentId, {});
      if (run.output_data) setLastOutput({ agentId, data: run.output_data });
      const updated = await api.getAgentRuns();
      setRuns(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(null);
    }
  };

  const toggleAgent = async (agentId: string, enabled: boolean) => {
    setToggling(agentId);
    try {
      await api.toggleAgent(agentId, enabled);
      reload();
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Agent Hub</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Enable, configure, and run AI agents. All runs are logged and auditable.
        </p>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={clsx(
              'glass-card p-4 transition-all',
              agent.enabled
                ? 'hover:border-indigo-800/50'
                : 'opacity-60 border-slate-700/30',
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-950/60 border border-indigo-800/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4.5 h-4.5 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-white leading-tight">{agent.name}</p>
                    {agent.has_manifest && (
                      <FileText className="w-3 h-3 text-slate-500" title="Has manifest" />
                    )}
                    {agent.voice_enabled && (
                      <Mic className="w-3 h-3 text-indigo-400" title="Voice enabled" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 capitalize">{agent.agent_type.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize', RISK_STYLES[agent.risk_level] ?? RISK_STYLES.low)}>
                  {agent.risk_level}
                </span>
                <button
                  onClick={() => toggleAgent(agent.id, !agent.enabled)}
                  disabled={toggling === agent.id}
                  title={agent.enabled ? 'Disable agent' : 'Enable agent'}
                  className={clsx(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                    agent.enabled
                      ? 'bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60'
                      : 'bg-slate-800 text-slate-500 hover:text-white',
                  )}
                >
                  {toggling === agent.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Power className="w-3 h-3" />
                  }
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed min-h-[32px]">
              {agent.description}
            </p>

            {agent.tools_allowed?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {agent.tools_allowed.map((t) => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 bg-slate-800/60 text-slate-400 rounded font-mono">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {agent.requires_approval_for?.length > 0 && (
              <div className="flex items-start gap-1.5 mb-3 text-[10px] text-amber-400/80 bg-amber-950/30 rounded-lg px-2 py-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>Requires approval for: {agent.requires_approval_for.join(', ')}</span>
              </div>
            )}

            <button
              onClick={() => runAgent(agent.id)}
              disabled={running === agent.id || !agent.enabled}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs text-white font-medium transition-colors w-full justify-center"
            >
              {running === agent.id
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Running…</>
                : <><Play className="w-3.5 h-3.5" />Run Agent</>
              }
            </button>
          </div>
        ))}
      </div>

      {/* Last output */}
      {lastOutput && (
        <div className="glass-card p-4 mb-6">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Last Output — {agents.find((a) => a.id === lastOutput.agentId)?.name}
          </h3>
          <pre className="text-xs text-slate-300 overflow-auto bg-[#0d0f14] rounded-lg p-3 max-h-60">
            {JSON.stringify(lastOutput.data, null, 2)}
          </pre>
        </div>
      )}

      {/* Run history */}
      <h2 className="text-sm font-semibold text-white mb-3">Recent Runs</h2>
      <div className="space-y-2">
        {runs.slice(0, 15).map((run) => (
          <div key={run.id} className="glass-card p-3 flex items-center gap-3">
            {run.status === 'completed'
              ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              : run.status === 'failed'
              ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              : <Loader2 className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin" />
            }
            <span className="text-xs text-slate-300 flex-1 truncate font-mono">
              {run.agent_id}
            </span>
            {run.task_id && (
              <span className="text-[10px] text-slate-600 truncate max-w-[100px]">
                task: {run.task_id.slice(0, 8)}
              </span>
            )}
            <span className={clsx('text-[10px] px-2 py-0.5 rounded font-medium', {
              'bg-emerald-950/50 text-emerald-400': run.status === 'completed',
              'bg-red-950/50 text-red-400':        run.status === 'failed',
              'bg-amber-950/50 text-amber-400':    run.status === 'running',
            })}>
              {run.status}
            </span>
            <span className="text-[10px] text-slate-600 flex-shrink-0 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(run.created_at).toLocaleTimeString()}
            </span>
          </div>
        ))}
        {runs.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-slate-500 text-sm">No agent runs yet.</p>
            <p className="text-slate-600 text-xs mt-1">Run an agent above to see results here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
