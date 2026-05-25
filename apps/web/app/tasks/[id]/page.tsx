'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, Clock, ArrowDownRight, Bot, Mail, Presentation,
  Phone, Archive, Trash2, Loader2, ChevronDown, X, AlertCircle,
} from 'lucide-react';
import { api, Task, Agent, AgentRun } from '@/lib/api';
import { clsx } from 'clsx';

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-400 border-red-800/40',
  high: 'bg-orange-500/15 text-orange-400 border-orange-800/40',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-800/40',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-800/40',
};

const STATUS_STYLES: Record<string, string> = {
  inbox: 'bg-slate-500/15 text-slate-400 border-slate-700/40',
  today: 'bg-indigo-500/15 text-indigo-400 border-indigo-700/40',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-700/40',
  waiting: 'bg-amber-500/15 text-amber-400 border-amber-700/40',
  deferred: 'bg-purple-500/15 text-purple-400 border-purple-700/40',
  done: 'bg-emerald-500/15 text-emerald-400 border-emerald-700/40',
};

type ActionState = { loading: boolean; success: boolean; error: string | null };

function useActionState(): [ActionState, (fn: () => Promise<void>) => void] {
  const [state, setState] = useState<ActionState>({ loading: false, success: false, error: null });
  const run = useCallback(async (fn: () => Promise<void>) => {
    setState({ loading: true, success: false, error: null });
    try {
      await fn();
      setState({ loading: false, success: true, error: null });
      setTimeout(() => setState(s => ({ ...s, success: false })), 2000);
    } catch (e: unknown) {
      setState({ loading: false, success: false, error: e instanceof Error ? e.message : 'Error' });
      setTimeout(() => setState(s => ({ ...s, error: null })), 4000);
    }
  }, []);
  const wrap = useCallback((fn: () => Promise<void>) => { void run(fn); }, [run]);
  return [state, wrap];
}

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [task, setTask] = useState<Task | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [notes, setNotes] = useState('');
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [completeState, runComplete] = useActionState();
  const [deferState, runDefer] = useActionState();
  const [waitState, runWait] = useActionState();
  const [delegateState, runDelegate] = useActionState();
  const [emailState, runEmail] = useActionState();
  const [callState, runCall] = useActionState();

  const load = useCallback(async () => {
    try {
      const [t, a, r] = await Promise.all([
        api.getTask(id),
        api.getAgents(),
        api.getAgentRuns(),
      ]);
      setTask(t);
      setTitleDraft(t.title);
      setAgents(a);
      setRuns(r.filter((run) => run.task_id === id));
    } catch {
      setError('Task not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const saveTitle = async () => {
    if (!task || titleDraft.trim() === task.title) { setEditingTitle(false); return; }
    await api.updateTask(id, { title: titleDraft.trim() });
    setTask(t => t ? { ...t, title: titleDraft.trim() } : t);
    setEditingTitle(false);
  };

  const handleComplete = () => runComplete(async () => {
    await api.completeTask(id);
    setTask(t => t ? { ...t, status: 'done' } : t);
  });

  const handleDefer = () => runDefer(async () => {
    await api.deferTask(id);
    setTask(t => t ? { ...t, status: 'deferred' } : t);
  });

  const handleWait = () => runWait(async () => {
    await api.markWaiting(id);
    setTask(t => t ? { ...t, status: 'waiting' } : t);
  });

  const handleDelegate = () => runDelegate(async () => {
    if (!selectedAgent || !task) return;
    await api.runAgent(selectedAgent, {
      task_id: id,
      title: task.title,
      context: task.context_summary || task.description || '',
    }, id);
    setShowAgentModal(false);
    await load();
  });

  const handleEmail = () => runEmail(async () => {
    if (!task) return;
    await api.runAgent('email_draft_agent', {
      subject: task.title,
      recipient: '',
      context: task.description || '',
      tone: 'professional',
    }, id);
  });

  const handleCall = () => runCall(async () => {
    if (!task) return;
    await api.runAgent('call_agent', {
      meeting_title: task.title,
      context: task.description || '',
      call_type: 'internal',
    }, id);
  });

  const handleDelete = async () => {
    await api.deleteTask(id);
    router.push('/');
  };

  const handleArchive = async () => {
    await api.updateTask(id, { status: 'deferred' });
    setTask(t => t ? { ...t, status: 'deferred' } : t);
    setShowDeleteConfirm(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading task…
    </div>
  );

  if (error || !task) return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
      <AlertCircle className="w-8 h-8 text-red-400" />
      <p>{error || 'Task not found'}</p>
      <button onClick={() => router.back()} className="text-indigo-400 text-sm hover:underline">Go back</button>
    </div>
  );

  const lastRun = runs[runs.length - 1];

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Title */}
          <div>
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={e => { if (e.key === 'Enter') void saveTitle(); if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft(task.title); } }}
                className="w-full text-2xl font-bold text-white bg-transparent border-b border-indigo-500 focus:outline-none pb-1"
              />
            ) : (
              <h1
                className="text-2xl font-bold text-white cursor-pointer hover:text-indigo-300 transition-colors"
                onClick={() => setEditingTitle(true)}
                title="Click to edit"
              >
                {task.title}
              </h1>
            )}

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={clsx('text-xs px-2 py-0.5 rounded-full border capitalize font-medium', PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium)}>
                {task.priority}
              </span>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full border capitalize font-medium', STATUS_STYLES[task.status] ?? STATUS_STYLES.inbox)}>
                {task.status.replace('_', ' ')}
              </span>
              {task.category && task.category !== 'general' && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-[#1e2847] text-slate-500 capitalize">{task.category}</span>
              )}
              {task.personal_or_work && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-[#1e2847] text-slate-600 capitalize">{task.personal_or_work}</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="bg-[#131720] border border-[#1e2847] rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</p>
            <p className="text-sm text-slate-300">{task.description || <span className="text-slate-600">No description</span>}</p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Source', value: task.source },
              { label: 'Due', value: task.due_date || '—' },
              { label: 'Created', value: new Date(task.created_at).toLocaleDateString() },
              { label: 'Updated', value: new Date(task.updated_at).toLocaleDateString() },
              { label: 'Confidence', value: task.confidence_score != null ? `${Math.round(task.confidence_score * 100)}%` : '—' },
              { label: 'Agent', value: task.agent_id || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#131720] border border-[#1e2847] rounded-lg p-3">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</p>
                <p className="text-xs text-slate-300 mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Next Action */}
          <div className="bg-[#131720] border border-[#1e2847] rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Next Action</p>
            <p className="text-sm text-slate-300">{task.next_action || <span className="text-slate-600">Not set</span>}</p>
          </div>

          {/* Context */}
          {task.context_summary && (
            <div className="bg-[#131720] border border-[#1e2847] rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Context</p>
              <p className="text-sm text-slate-300">{task.context_summary}</p>
            </div>
          )}

          {/* Last Agent Output */}
          {lastRun && lastRun.output_data && (
            <div className="bg-[#131720] border border-indigo-900/40 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                Agent Output — {lastRun.agent_id}
              </p>
              <pre className="text-xs text-slate-400 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(lastRun.output_data, null, 2)}
              </pre>
            </div>
          )}

          {/* Notes */}
          <div className="bg-[#131720] border border-[#1e2847] rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={async () => { if (notes) await api.updateTask(id, { description: (task.description || '') + '\n\n' + notes }); }}
              placeholder="Add notes…"
              rows={3}
              className="w-full bg-transparent text-sm text-slate-300 placeholder-slate-600 resize-none focus:outline-none"
            />
          </div>
        </div>

        {/* Action sidebar */}
        <div className="w-52 flex-shrink-0 space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Actions</p>

          <ActionButton icon={CheckCircle2} label="Complete" state={completeState} onClick={handleComplete} color="emerald" />
          <ActionButton icon={ArrowDownRight} label="Defer" state={deferState} onClick={handleDefer} color="amber" />
          <ActionButton icon={Clock} label="Mark Waiting" state={waitState} onClick={handleWait} color="blue" />

          <div className="pt-1 pb-1 border-t border-[#1e2847]" />

          <button
            onClick={() => setShowAgentModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#131720] border border-[#1e2847] text-xs text-slate-300 hover:border-indigo-600/60 hover:text-white transition-all"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-400" /> Delegate to Agent
          </button>

          <ActionButton icon={Mail} label="Draft Email" state={emailState} onClick={handleEmail} color="sky" />
          <ActionButton icon={Phone} label="Prep Call" state={callState} onClick={handleCall} color="violet" />

          <div className="pt-1 pb-1 border-t border-[#1e2847]" />

          <button
            onClick={handleArchive}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#131720] border border-[#1e2847] text-xs text-slate-400 hover:text-white transition-all"
          >
            <Archive className="w-3.5 h-3.5" /> Archive
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#131720] border border-red-900/40 text-xs text-red-400 hover:bg-red-950/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Agent selection modal */}
      {showAgentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-6 w-96 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Select Agent</h3>
              <button onClick={() => setShowAgentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 mb-4">
              {agents.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAgent(a.id)}
                  className={clsx(
                    'w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-all',
                    selectedAgent === a.id
                      ? 'border-indigo-500 bg-indigo-950/40 text-white'
                      : 'border-[#1e2847] text-slate-400 hover:border-indigo-800/60 hover:text-white',
                  )}
                >
                  <p className="font-medium">{a.name}</p>
                  <p className="text-slate-600 mt-0.5 line-clamp-1">{a.description}</p>
                </button>
              ))}
            </div>
            <button
              onClick={handleDelegate}
              disabled={!selectedAgent || delegateState.loading}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {delegateState.loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Run Agent
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#131720] border border-red-900/40 rounded-2xl p-6 w-80">
            <h3 className="text-sm font-semibold text-white mb-2">Delete task?</h3>
            <p className="text-xs text-slate-400 mb-5">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2 rounded-lg border border-[#1e2847] text-xs text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={() => void handleDelete()} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white font-medium transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon, label, state, onClick, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  state: ActionState;
  onClick: () => void;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    sky: 'text-sky-400',
    violet: 'text-violet-400',
  };
  return (
    <button
      onClick={onClick}
      disabled={state.loading}
      className={clsx(
        'w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#131720] border text-xs transition-all',
        state.success ? 'border-emerald-600/50 text-emerald-400' : 'border-[#1e2847] text-slate-300 hover:border-slate-600 hover:text-white',
      )}
    >
      {state.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className={`w-3.5 h-3.5 ${colorMap[color] ?? ''}`} />}
      {state.success ? '✓ Done' : label}
    </button>
  );
}
