'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle, Volume2, VolumeX, History, RotateCw } from 'lucide-react';
import { api, type CommandExecution, type VoiceHistoryRecord } from '@/lib/api';
import { clsx } from 'clsx';

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'done' | 'error';

const CONFIRM_WORDS = ['yes', 'confirm', 'execute', 'execute it', 'do it', 'go ahead', 'proceed'];
const CANCEL_WORDS = ['cancel', 'no', 'stop', 'nevermind', 'never mind', 'abort'];

export default function VoicePage() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [execution, setExecution] = useState<CommandExecution | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<VoiceHistoryRecord[]>([]);
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [continuousMode, setContinuousMode] = useState(true);

  const recognitionRef = useRef<unknown>(null);
  const finalTranscriptRef = useRef('');
  const restartTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const ignoreNextEndRef = useRef(false);
  const closingRef = useRef(false);
  // Track pending command awaiting voice confirmation
  const pendingCommandRef = useRef<CommandExecution | null>(null);

  useEffect(() => {
    api.getVoiceHistory()
      .then((data) => setHistory(data.slice(0, 5)))
      .catch(() => {});

    api.getVoiceSettings()
      .then((s) => { if (typeof s.tts_enabled === 'boolean') setVoiceReplies(s.tts_enabled); })
      .catch(() => {});

    return () => {
      clearTimeout(restartTimerRef.current);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      (recognitionRef.current as any)?.abort?.();
    };
  }, []);

  // Keep ref in sync with state so recognition handlers can read it
  useEffect(() => {
    pendingCommandRef.current = execution?.status === 'awaiting_confirmation' ? execution : null;
  }, [execution]);

  const chooseVoice = (): SpeechSynthesisVoice | null => {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => /samantha|alex|google us english|microsoft aria/i.test(v.name)) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
      null
    );
  };

  const speak = (text: string): Promise<boolean> => new Promise((resolve) => {
    if (!voiceReplies || !('speechSynthesis' in window) || !text.trim()) { resolve(false); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = chooseVoice();
    utterance.rate = 0.98;
    utterance.pitch = 0.96;
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.resume();
  });

  const queueNextListen = (delay = 650) => {
    if (!continuousMode || closingRef.current) return;
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      if (!closingRef.current) startListening();
    }, delay);
  };

  const isStopCommand = (text: string): boolean => {
    const n = text.trim().toLowerCase();
    return ['stop listening', 'stop jarvis', 'close voice', 'cancel voice', 'exit voice', 'goodbye jarvis'].some(
      (p) => n.includes(p)
    );
  };

  const speakThenMaybeListen = async (message: string, nextState: VoiceState = 'done') => {
    if (voiceReplies && 'speechSynthesis' in window) {
      setVoiceState('speaking');
      await speak(message);
    }
    if (closingRef.current) return;
    if (nextState === 'done' && continuousMode) { queueNextListen(); return; }
    setVoiceState(nextState);
  };

  const refreshHistory = () => {
    api.getVoiceHistory()
      .then((data) => setHistory(data.slice(0, 5)))
      .catch(() => {});
  };

  const processCommand = async (text: string) => {
    setVoiceState('processing');
    try {
      const result = await api.executeCommand(text, 'voice');
      setExecution(result);

      if (result.status === 'awaiting_confirmation') {
        const msg = result.confirmation_message || result.user_visible_summary || 'Confirm?';
        await speakThenMaybeListen(msg, 'done');
      } else {
        const msg = executionSpeechText(result);
        await speakThenMaybeListen(msg, 'done');
        refreshHistory();
      }
    } catch {
      setErrorMsg('Failed to process command. Is the API running?');
      await speakThenMaybeListen('I heard you but could not reach the API.', 'error');
    }
  };

  const handleVoiceConfirm = async (method: 'voice' | 'button' = 'button') => {
    const pending = pendingCommandRef.current;
    if (!pending?.id) return;
    setVoiceState('processing');
    try {
      const result = await api.confirmCommand(pending.id, method);
      setExecution(result);
      const msg = executionSpeechText(result);
      await speakThenMaybeListen(msg, 'done');
      refreshHistory();
    } catch {
      setErrorMsg('Confirmation failed.');
      setVoiceState('error');
    }
  };

  const handleVoiceCancel = async (method: 'voice' | 'button' = 'button') => {
    const pending = pendingCommandRef.current;
    if (pending?.id) {
      try { await api.cancelCommand(pending.id); } catch { /* best-effort */ }
    }
    setExecution(null);
    if (method === 'voice') {
      await speakThenMaybeListen('Cancelled.', 'done');
    } else {
      setTranscript('');
      setVoiceState('idle');
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg('Browser speech recognition not available. Please use Chrome or Edge.');
      setVoiceState('error');
      return;
    }

    closingRef.current = false;
    ignoreNextEndRef.current = false;
    clearTimeout(restartTimerRef.current);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    setVoiceState('listening');
    setTranscript('');
    setErrorMsg('');
    finalTranscriptRef.current = '';

    recognition.onresult = (e: any) => {
      const t = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join('');
      setTranscript(t);
      finalTranscriptRef.current = t;
    };

    recognition.onend = async () => {
      if (ignoreNextEndRef.current) { ignoreNextEndRef.current = false; return; }
      if (closingRef.current) return;

      const final = finalTranscriptRef.current.trim();
      if (!final) { setVoiceState('idle'); queueNextListen(450); return; }

      if (isStopCommand(final)) {
        await speakThenMaybeListen('Okay, stopping.', 'done');
        stopListening();
        return;
      }

      // If a command is awaiting confirmation, check for voice confirm/cancel
      const pending = pendingCommandRef.current;
      if (pending) {
        const lower = final.toLowerCase();
        if (CONFIRM_WORDS.some((w) => lower.includes(w))) {
          await handleVoiceConfirm('voice');
          return;
        }
        if (CANCEL_WORDS.some((w) => lower.includes(w))) {
          await handleVoiceCancel('voice');
          return;
        }
        // New command — auto-cancel the pending one silently then process
        try { await api.cancelCommand(pending.id); } catch { /* best-effort */ }
        setExecution(null);
      }

      await processCommand(final);
    };

    recognition.onerror = (e: any) => {
      if (closingRef.current || e.error === 'aborted') return;
      if (e.error === 'no-speech') return;
      ignoreNextEndRef.current = true;
      setErrorMsg(`Recognition error: ${e.error}`);
      setVoiceState('error');
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    closingRef.current = true;
    clearTimeout(restartTimerRef.current);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    (recognitionRef.current as any)?.abort?.();
    setVoiceState('idle');
  };

  const buttonLabel: Record<VoiceState, string> = {
    idle: 'Click to speak',
    listening: 'Listening… click to stop',
    processing: 'Processing…',
    speaking: 'Speaking… click to stop',
    done: 'Done! Click to speak again',
    error: 'Error — click to retry',
  };

  const parseIntent = (routingResult: unknown): string => {
    if (typeof routingResult === 'object' && routingResult !== null) {
      const r = routingResult as Record<string, unknown>;
      return String(r.intent ?? r.user_visible_summary ?? 'unknown');
    }
    if (typeof routingResult === 'string') {
      try {
        const p = JSON.parse(routingResult) as Record<string, unknown>;
        return String(p.intent ?? routingResult);
      } catch { return routingResult; }
    }
    return String(routingResult ?? 'unknown');
  };

  const formatTimestamp = (iso: string): string => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Voice Interface</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Push-to-talk with real command execution. Say &quot;confirm&quot; or &quot;cancel&quot; for risky actions.
        </p>
      </div>

      {/* Mic button */}
      <div className="flex flex-col items-center py-10">
        <button
          onClick={voiceState === 'listening' || voiceState === 'speaking' ? stopListening : startListening}
          disabled={voiceState === 'processing'}
          className={clsx(
            'w-28 h-28 rounded-full flex items-center justify-center transition-all duration-200',
            voiceState === 'listening'
              ? 'bg-red-600 ring-8 ring-red-600/20 animate-pulse'
              : voiceState === 'speaking'
              ? 'bg-emerald-600 ring-8 ring-emerald-600/20 animate-pulse'
              : voiceState === 'processing'
              ? 'bg-indigo-700 opacity-70 cursor-not-allowed'
              : voiceState === 'error'
              ? 'bg-red-900 hover:bg-red-800 ring-4 ring-red-900/30'
              : 'bg-indigo-600 hover:bg-indigo-500 ring-4 ring-indigo-600/20 hover:ring-indigo-600/40',
          )}
        >
          {voiceState === 'listening'
            ? <MicOff className="w-12 h-12 text-white" />
            : voiceState === 'processing'
            ? <Loader2 className="w-12 h-12 text-white animate-spin" />
            : voiceState === 'speaking'
            ? <Volume2 className="w-12 h-12 text-white" />
            : <Mic className="w-12 h-12 text-white" />
          }
        </button>
        <p className="mt-4 text-sm text-slate-400">{buttonLabel[voiceState]}</p>
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setVoiceReplies((v) => { if (v && 'speechSynthesis' in window) window.speechSynthesis.cancel(); return !v; })}
            title={voiceReplies ? 'Voice replies on' : 'Voice replies off'}
            className="w-9 h-9 rounded-full bg-[#1a2035] border border-[#1e2847] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            {voiceReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setContinuousMode((v) => { if (v) clearTimeout(restartTimerRef.current); return !v; })}
            title={continuousMode ? 'Continuous on' : 'Continuous off'}
            className={clsx(
              'w-9 h-9 rounded-full border flex items-center justify-center transition-colors',
              continuousMode
                ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-[#1a2035] border-[#1e2847] text-slate-400 hover:text-white',
            )}
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="glass-card p-4 mb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">You said</p>
          <p className="text-sm text-white italic">&quot;{transcript}&quot;</p>
        </div>
      )}

      {/* Execution result */}
      {execution && (
        <div className={clsx(
          'glass-card p-4 mb-4',
          execution.status === 'awaiting_confirmation' ? 'border-amber-800/40' :
          execution.status === 'failed' ? 'border-red-800/40' :
          'border-emerald-800/40'
        )}>
          <div className="flex items-center gap-2 mb-2">
            {execution.status === 'awaiting_confirmation'
              ? <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              : execution.status === 'failed'
              ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              : <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            }
            <p className="text-xs font-medium text-white">
              Intent: <span className="text-indigo-400 font-mono">{execution.intent || execution.interpreted_intent}</span>
            </p>
            <span className="ml-auto text-[10px] text-slate-500">
              {execution.status}
              {execution.latency_ms ? ` · ${execution.latency_ms}ms` : ''}
            </span>
          </div>

          <p className="text-sm text-slate-200">
            {execution.status === 'awaiting_confirmation'
              ? (execution.confirmation_message || execution.user_visible_summary)
              : executionSummary(execution)}
          </p>

          {execution.status === 'awaiting_confirmation' && (
            <div className="mt-3 flex gap-2 items-center">
              <button
                onClick={() => handleVoiceConfirm('button')}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs text-white font-medium transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => handleVoiceCancel('button')}
                className="px-3 py-1.5 bg-[#1a2035] hover:bg-[#1e2847] rounded-lg text-xs text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <span className="text-[10px] text-slate-500 ml-1">or say &quot;confirm&quot; / &quot;cancel&quot;</span>
            </div>
          )}

          {execution.status === 'completed' && execution.execution_result && (
            <div className="mt-2 text-[10px] text-emerald-500 font-mono">
              {JSON.stringify(execution.execution_result).slice(0, 120)}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="glass-card p-3 border-red-900/40 mb-4">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* STT status */}
      <div className="glass-card p-4 mb-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-indigo-400" />
          Speech Stack
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white">Push-to-talk (Browser API)</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Uses browser SpeechRecognition</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 rounded-full font-medium">
              ✓ Active
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white">Always-on &quot;Hey Jarvis&quot;</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Local wake word (openWakeWord)</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 rounded-full font-medium">
              Phase 8 — Planned
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white">Local STT (whisper.cpp)</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Offline speech-to-text</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-purple-950/60 text-purple-400 border border-purple-800/40 rounded-full font-medium">
              Phase 4 — Planned
            </span>
          </div>
        </div>
      </div>

      {/* Recent Voice Commands */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-400" />
          Recent Voice Commands
        </h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">No voice commands recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 py-2 border-b border-[#1e2847] last:border-0">
                <div className="min-w-0">
                  <p className="text-xs text-white truncate">&quot;{entry.text}&quot;</p>
                  <p className="text-[10px] text-indigo-400 font-mono mt-0.5">
                    {parseIntent(entry.routing_result)}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0 mt-0.5">
                  {formatTimestamp(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function executionSpeechText(result: CommandExecution): string {
  if (result.status === 'failed') return result.error_message || 'Command failed.';
  if (result.status === 'completed') {
    const r = result.execution_result;
    if (r?.title) return `Done. Created task: ${r.title}`;
    if (r?.status === 'completed') return `Task marked as complete.`;
    if (r?.status === 'deferred') return `Task deferred.`;
    if (r?.status === 'waiting') return `Task marked as waiting.`;
    if (r?.count !== undefined) return `Found ${r.count} tasks for today.`;
    return result.user_visible_summary || 'Done.';
  }
  return result.user_visible_summary || 'Command received.';
}

function executionSummary(result: CommandExecution): string {
  if (result.status === 'failed') return result.error_message || 'Command failed.';
  if (result.status === 'completed') {
    const r = result.execution_result;
    if (r?.title) return `Created: "${r.title}"`;
    if (r?.status === 'completed') return `Completed: "${r.title}"`;
    if (r?.status === 'deferred') return `Deferred task`;
    if (r?.count !== undefined) return `${r.count} tasks today`;
    return result.user_visible_summary || 'Done.';
  }
  return result.user_visible_summary || 'Command received.';
}
