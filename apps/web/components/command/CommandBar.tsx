'use client';
import { useState, useRef, useEffect } from 'react';
import { Search, Mic, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useStore } from '@/stores/useStore';
import { clsx } from 'clsx';

export default function CommandBar() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{
    summary: string;
    intent: string;
    requires_confirmation: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const { routeCommand, isCommandPending, createTask } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isCommandPending) return;
    setError('');
    setResult(null);
    try {
      const r = await routeCommand(input.trim());
      setResult({
        summary: r.user_visible_summary,
        intent: r.intent,
        requires_confirmation: r.requires_confirmation,
      });
      // Auto-execute safe actions
      if (!r.requires_confirmation) {
        if (r.intent === 'create_task' && r.parameters?.title) {
          await createTask({ title: r.parameters.title as string });
        }
      }
      setInput('');
    } catch {
      setError('Command failed. Is Ollama running?');
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  return (
    <div className="relative w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-2 bg-[#1a2035] border border-[#2d3a5c] rounded-xl px-4 py-2.5 focus-within:border-indigo-500 transition-colors">
          {isCommandPending ? (
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
          />
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 bg-[#0d0f14] px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
          <button
            type="button"
            className="text-slate-500 hover:text-indigo-400 transition-colors"
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>
      </form>

      {result && (
        <div
          className={clsx(
            'absolute top-full mt-1 w-full rounded-lg px-3 py-2 text-xs flex items-center gap-2 z-50',
            result.requires_confirmation
              ? 'bg-amber-900/40 border border-amber-600/40 text-amber-300'
              : 'bg-emerald-900/40 border border-emerald-600/40 text-emerald-300'
          )}
        >
          {result.requires_confirmation ? (
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-3 h-3 flex-shrink-0" />
          )}
          <span>{result.summary}</span>
          {result.requires_confirmation && (
            <button className="ml-auto px-2 py-0.5 bg-amber-600 rounded text-white text-[10px]">
              Confirm
            </button>
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
