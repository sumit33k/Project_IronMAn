'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/stores/useStore';
import { api, AgentRun } from '@/lib/api';
import { Bot, Play, Loader2, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

const RISK_STYLES: Record<string, string> = {
  low:    'bg-emerald-950/50 text-emerald-400 border-emerald-800/30',
  medium: 'bg-amber-950/50  text-amber-400  border-amber-800/30',
  high:   'bg-red-950/50    text-red-400    border-red-800/30',
};

export default function AgentsPage() {
  const { agents, loadAgents } = useStore();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<{ agentId: string; data: unknown } | null>(null);

  useEffect(() => {
    void loadAgents();
    api.getAgentRuns().then(setRuns).catch(console.error);
  }, [loadAgents]);

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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Agent Hub</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Delegate work to AI agents. All runs are logged and auditable.
        </p>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {agents.map((agent) => (
          <div key={agent.id} className="glass-card p-4 hover:border-indigo-800/50 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-950/60 border border-indigo-800/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4.5 h-4.5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{agent.name}</p>
                  <p className="text-[10px] text-slate-500 capitalize">{agent.agent_type.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize', RISK_STYLES[agent.risk_level] ?? RISK_STYLES.low)}>
                {agent.risk_level}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-3 leading-relaxed min-h-[32px]">
              {agent.description}
            </p>

            {(agent as unknown as { requires_approval_for?: string[] }).requires_approval_for?.length && (
              <div className="flex items-start gap-1.5 mb-3 text-[10px] text-amber-400/80 bg-amber-950/30 rounded-lg px-2 py-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>Requires approval for: {(agent as unknown as { requires_approval_for: string[] }).requires_approval_for.join(', ')}</span>
              </div>
            )}

            <button
              onClick={() => runAgent(agent.id)}
              disabled={running === agent.id}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-xs text-white font-medium transition-colors w-full justify-center"
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
