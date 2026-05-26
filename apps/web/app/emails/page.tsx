'use client';

import { useEffect, useState } from 'react';
import { Mail, Loader2, AlertTriangle, Copy, Check, ChevronDown, ChevronUp, Bot } from 'lucide-react';
import { api, AgentRun } from '@/lib/api';
import { clsx } from 'clsx';

const TONES = ['professional', 'friendly', 'formal', 'casual'] as const;
type Tone = typeof TONES[number];

interface DraftOutput {
  draft_body?: string;
  subject?: string;
  key_points?: string[];
  tone_used?: string;
}

export default function EmailsPage() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [context, setContext] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [drafting, setDrafting] = useState(false);
  const [draftOutput, setDraftOutput] = useState<DraftOutput | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<AgentRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const loadHistory = async () => {
    try {
      const runs = await api.getAgentRuns();
      setHistory(runs.filter(r => r.agent_id === 'email_draft_agent').slice(0, 5));
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { void loadHistory(); }, []);

  const handleDraft = async () => {
    if (!subject.trim() && !context.trim()) return;
    setDrafting(true);
    setError(null);
    setDraftOutput(null);
    try {
      const run = await api.runAgent('email_draft_agent', {
        subject: subject.trim(),
        recipient: to.trim(),
        context: context.trim(),
        tone,
      });
      const out = (run.output_data ?? {}) as DraftOutput;
      setDraftOutput(out);
      setDraftBody(out.draft_body ?? '');
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to draft email');
    } finally {
      setDrafting(false);
    }
  };

  const handleCopy = async () => {
    if (!draftBody) return;
    await navigator.clipboard.writeText(draftBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Mail className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Email Composer</h1>
          <p className="text-xs text-slate-500">Draft emails with Jarvis AI assistance</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Left: Compose form */}
        <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-white">Compose</p>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">To</label>
            <input
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-600"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject…"
              className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-600"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Context / Notes</label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="What do you want to say? Any background context, key points to include…"
              rows={5}
              className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-600 resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-2 block">Tone</label>
            <div className="flex gap-2 flex-wrap">
              {TONES.map(t => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                    tone === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#1a2035] border border-[#1e2847] text-slate-400 hover:text-white hover:border-indigo-600/40'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={() => void handleDraft()}
            disabled={drafting || (!subject.trim() && !context.trim())}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors font-medium"
          >
            {drafting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Drafting with Jarvis…</>
            ) : (
              <><Bot className="w-4 h-4" /> Draft with Jarvis</>
            )}
          </button>
        </div>

        {/* Right: Draft output */}
        <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-white">Draft Output</p>

          {!draftOutput && !drafting && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <Mail className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Fill out the form and click &ldquo;Draft with Jarvis&rdquo;</p>
            </div>
          )}

          {drafting && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Generating draft…
            </div>
          )}

          {draftOutput && !drafting && (
            <div className="space-y-4">
              {/* Key points */}
              {draftOutput.key_points && draftOutput.key_points.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2">Key Points</p>
                  <ul className="space-y-1">
                    {draftOutput.key_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Draft body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-400">Draft Body</p>
                  <button
                    onClick={() => void handleCopy()}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <textarea
                  value={draftBody}
                  onChange={e => setDraftBody(e.target.value)}
                  rows={10}
                  className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full resize-none"
                />
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-800/40 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  <span className="font-semibold">Requires confirmation.</span> Sending emails always requires your explicit approval. Review the draft before sending via your email client.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="bg-[#131720] border border-[#1e2847] rounded-2xl overflow-hidden">
        <button
          onClick={() => setHistoryExpanded(x => !x)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/2 transition-colors"
        >
          <p className="text-sm font-semibold text-white">Recent Drafts</p>
          {historyExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {historyExpanded && (
          <div className="border-t border-[#1e2847] divide-y divide-[#1e2847]">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-slate-600 text-sm">No draft history yet.</div>
            ) : (
              history.map(run => {
                const out = (run.output_data ?? {}) as DraftOutput;
                const inp = run.input_data ?? {};
                return (
                  <div key={run.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{String(inp.subject || '(no subject)')}</p>
                        {inp.recipient ? (
                          <p className="text-xs text-slate-500 mt-0.5">To: {String(inp.recipient)}</p>
                        ) : null}
                        {out.draft_body && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{out.draft_body.slice(0, 120)}…</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={clsx(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium',
                          run.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        )}>
                          {run.status}
                        </span>
                        <p className="text-[10px] text-slate-600 mt-1">{formatTime(run.created_at)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
