'use client';
import { useState, useRef, useEffect } from 'react';
import { Search, Mic, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { api, type CommandExecution } from '@/lib/api';
import { clsx } from 'clsx';

type BarState = 'idle' | 'executing' | 'awaiting_confirmation' | 'done' | 'error';

export default function CommandBar() {
  const [input, setInput] = useState('');
  const [barState, setBarState] = useState<BarState>('idle');
  const [execution, setExecution] = useState<CommandExecution | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || barState === 'executing') return;
    setError('');
    setExecution(null);
    setBarState('executing');

    try {
      const result = await api.executeCommand(input.trim());
      setExecution(result);
      setBarState(
        result.status === 'awaiting_confirmation' ? 'awaiting_confirmation' : 'done'
      );
      setInput('');
    } catch {
      setError('Command failed. Is the API running?');
      setBarState('error');
    }
  };

  const handleConfirm = async () => {
    if (!execution?.id) return;
    setBarState('executing');
    try {
      const result = await api.confirmCommand(execution.id, 'button');
      setExecution(result);
      setBarState('done');
    } catch {
      setError('Confirmation failed.');
      setBarState('error');
    }
  };

  const handleCancel = async () => {
    if (execution?.id) {
      try {
        await api.cancelCommand(execution.id);
      } catch {
        // best-effort cancel
      }
    }
    setExecution(null);
    setBarState('idle');
    setError('');
  };

  const handleDismiss = () => {
    setExecution(null);
    setBarState('idle');
    setError('');
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const summaryText =
    execution?.user_visible_summary ||
    execution?.intent?.replace(/_/g, ' ') ||
    'Command received.';

  const resultText =
    execution?.execution_result?.title
      ? `Created: "${execution.execution_result.title}"`
      : execution?.execution_result?.status === 'completed'
      ? `Done: ${execution.execution_result.title ?? 'task completed'}`
      : execution?.execution_result?.status === 'error'
      ? `Error: ${execution.execution_result.message}`
      : null;

  return (
    <div className="relative w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-2 bg-[#1a2035] border border-[#2d3a5c] rounded-xl px-4 py-2.5 focus-within:border-indigo-500 transition-colors">
          {barState === 'executing' ? (
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hey Jarvis, what should I focus on? (⌘K)"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            disabled={barState === 'executing'}
          />
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 bg-[#0d0f14] px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
          <button
            type="button"
            className="text-slate-500 hover:text-indigo-400 transition-colors"
            onClick={() => window.location.assign('/voice')}
            title="Open voice interface"
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Execution result / confirmation card */}
      {execution && barState !== 'idle' && (
        <div
          className={clsx(
            'absolute top-full mt-1 w-full rounded-lg px-3 py-2.5 text-xs z-50 border',
            barState === 'awaiting_confirmation'
              ? 'bg-amber-900/40 border-amber-600/40 text-amber-300'
              : barState === 'error' || execution.status === 'failed'
              ? 'bg-red-900/40 border-red-600/40 text-red-300'
              : 'bg-emerald-900/40 border-emerald-600/40 text-emerald-300'
          )}
        >
          <div className="flex items-start gap-2">
            {barState === 'awaiting_confirmation' ? (
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            ) : barState === 'error' || execution.status === 'failed' ? (
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="leading-snug">
                {barState === 'awaiting_confirmation'
                  ? (execution.confirmation_message || summaryText)
                  : resultText || summaryText}
              </p>
              {execution.latency_ms && (
                <p className="text-[10px] opacity-50 mt-0.5">{execution.latency_ms}ms</p>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {barState === 'awaiting_confirmation' && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleConfirm}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 rounded text-white text-[10px] font-medium transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={handleCancel}
                className="px-2.5 py-1 bg-[#1a2035] hover:bg-[#1e2847] rounded text-slate-300 text-[10px] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="absolute top-full mt-1 w-full rounded-lg px-3 py-2 text-xs bg-red-900/40 border border-red-600/40 text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
