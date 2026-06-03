'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, MicOff, Loader2, CheckCircle, AlertCircle,
  Volume2, VolumeX, History, RotateCw, Phone, PhoneOff,
  Activity, Clock, MessageSquare, Zap, Settings, ChevronDown, ChevronUp,
  Sparkles, Radio,
} from 'lucide-react';
import { api, type CommandExecution, type VoiceHistoryRecord, type VoiceSession, type ProvidersHealth, type VoiceProviderConfig } from '@/lib/api';
import { clsx } from 'clsx';

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'done' | 'error';
type CallState = 'inactive' | 'connecting' | 'active' | 'ending';

const CONFIRM_WORDS = ['yes', 'confirm', 'execute', 'execute it', 'do it', 'go ahead', 'proceed'];
const CANCEL_WORDS = ['cancel', 'no', 'stop', 'nevermind', 'never mind', 'abort'];

interface LocalTurn {
  id: string;
  role: 'user' | 'assistant';
  transcript: string;
  latency_ms?: number;
  status?: 'completed' | 'failed' | 'awaiting_confirmation';
  intent?: string;
}

export default function VoicePage() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [callState, setCallState] = useState<CallState>('inactive');
  const [transcript, setTranscript] = useState('');
  const [execution, setExecution] = useState<CommandExecution | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<VoiceHistoryRecord[]>([]);
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [continuousMode, setContinuousMode] = useState(true);

  // Session state
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [localTurns, setLocalTurns] = useState<LocalTurn[]>([]);

  // Provider health
  const [health, setHealth] = useState<ProvidersHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Voice config (barge-in + wake word settings)
  const [voiceConfig, setVoiceConfig] = useState<VoiceProviderConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const recognitionRef = useRef<unknown>(null);
  const finalTranscriptRef = useRef('');
  const restartTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const ignoreNextEndRef = useRef(false);
  const closingRef = useRef(false);
  const pendingCommandRef = useRef<CommandExecution | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const sessionStartRef = useRef<number>(0);
  const turnStartRef = useRef<number>(0);

  // Barge-in (Phase 7)
  const bargeInEnabledRef = useRef(true); // ref so speak() closure reads current value without stale capture
  const bargeInTextRef = useRef('');
  const bargeInRecognitionRef = useRef<unknown>(null);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const h = await api.getProvidersHealth();
      setHealth(h);
    } catch { /* non-fatal */ }
    finally { setHealthLoading(false); }
  }, []);

  useEffect(() => {
    api.getVoiceHistory()
      .then((data) => setHistory(data.slice(0, 8)))
      .catch(() => {});
    api.getVoiceSettings()
      .then((s) => { if (typeof s.tts_enabled === 'boolean') setVoiceReplies(s.tts_enabled); })
      .catch(() => {});
    api.getVoiceConfig()
      .then((cfg) => { setVoiceConfig(cfg); bargeInEnabledRef.current = cfg.reply_style?.barge_in_enabled ?? true; })
      .catch(() => {});
    refreshHealth();

    return () => {
      clearTimeout(restartTimerRef.current);
      clearInterval(durationIntervalRef.current);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      (recognitionRef.current as any)?.abort?.();
      (bargeInRecognitionRef.current as any)?.abort?.();
    };
  }, [refreshHealth]);

  useEffect(() => {
    pendingCommandRef.current = execution?.status === 'awaiting_confirmation' ? execution : null;
  }, [execution]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // ── Session lifecycle ──────────────────────────────────────────────────────

  const startSession = async (): Promise<VoiceSession | null> => {
    try {
      const s = await api.createVoiceSession({ stt: 'browser', tts: 'browser', transport: 'browser' });
      setSession(s);
      setLocalTurns([]);
      sessionStartRef.current = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }, 1000);
      return s;
    } catch {
      return null;
    }
  };

  const endSession = async () => {
    clearInterval(durationIntervalRef.current);
    setSessionDuration(0);
    const s = sessionRef.current;
    if (s) {
      try { await api.endVoiceSession(s.id); } catch { /* best-effort */ }
    }
    setSession(null);
    setLocalTurns([]);
  };

  const logTurn = async (role: 'user' | 'assistant', text: string, latencyMs?: number, cmdId?: string) => {
    const s = sessionRef.current;
    if (!s) return;
    const localId = `${role}-${Date.now()}`;
    setLocalTurns((prev: LocalTurn[]) => [...prev, {
      id: localId,
      role,
      transcript: text,
      latency_ms: latencyMs,
    }]);
    try {
      await api.addVoiceTurn(s.id, {
        role,
        transcript: text,
        ...(latencyMs ? { stt_latency_ms: latencyMs } : {}),
        ...(cmdId ? { command_id: cmdId } : {}),
      });
      // Refresh session counters
      const updated = await api.getVoiceSession(s.id);
      setSession(updated);
    } catch { /* non-fatal */ }
  };

  // ── Speech helpers ──────────────────────────────────────────────────────────

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
    bargeInTextRef.current = '';
    (bargeInRecognitionRef.current as any)?.abort?.();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = chooseVoice();
    utterance.rate = 0.98;
    utterance.pitch = 0.96;
    utterance.onend = () => { (bargeInRecognitionRef.current as any)?.abort?.(); resolve(true); };
    utterance.onerror = () => { (bargeInRecognitionRef.current as any)?.abort?.(); resolve(false); };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.resume();

    // Phase 7: barge-in — listen in parallel while TTS plays
    if (bargeInEnabledRef.current && !closingRef.current) {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        const bi = new SpeechRec();
        bi.continuous = false;
        bi.interimResults = true;
        bi.lang = 'en-US';
        bi.onresult = (e: any) => {
          const t = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join('').trim();
          if (t.length > 1) {
            bargeInTextRef.current = t;
            window.speechSynthesis.cancel(); // triggers utterance.onerror → resolve(false)
            bi.abort();
          }
        };
        bi.onerror = () => {};
        bi.onend = () => {};
        bargeInRecognitionRef.current = bi;
        try { bi.start(); } catch { /* non-fatal if recognition already running */ }
      }
    }
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
      // Phase 7: if barge-in captured text during TTS, process it immediately
      const bargeInText = bargeInTextRef.current;
      if (bargeInText && !closingRef.current) {
        bargeInTextRef.current = '';
        setTranscript(bargeInText);
        finalTranscriptRef.current = bargeInText;
        turnStartRef.current = Date.now();
        await processCommand(bargeInText);
        return;
      }
    }
    if (closingRef.current) return;
    if (nextState === 'done' && continuousMode) { queueNextListen(); return; }
    setVoiceState(nextState);
  };

  const refreshHistory = () => {
    api.getVoiceHistory()
      .then((data) => setHistory(data.slice(0, 8)))
      .catch(() => {});
  };

  // ── Command processing ──────────────────────────────────────────────────────

  const processCommand = async (text: string) => {
    const sttLatency = turnStartRef.current ? Date.now() - turnStartRef.current : undefined;
    setVoiceState('processing');
    const s = sessionRef.current;
    try {
      const t0 = Date.now();
      const result = await api.executeCommand(text, 'voice', {}, s?.id ?? undefined);
      const totalLatency = Date.now() - t0;
      setExecution(result);

      // Log user turn
      await logTurn('user', text, sttLatency, result.id);

      if (result.status === 'awaiting_confirmation') {
        const msg = result.confirmation_message || result.user_visible_summary || 'Confirm?';
        await logTurn('assistant', msg);
        await speakThenMaybeListen(msg, 'done');
      } else {
        const msg = executionSpeechText(result);
        await logTurn('assistant', msg);
        // Patch local turn with status + intent
        setLocalTurns((prev: LocalTurn[]) => prev.map((t: LocalTurn, i: number) =>
          i === prev.length - 1
            ? { ...t, status: result.status as LocalTurn['status'], intent: result.intent || result.interpreted_intent }
            : t
        ));
        await speakThenMaybeListen(msg, 'done');
        refreshHistory();
      }

      // Annotate the last assistant turn with latency
      setLocalTurns((prev: LocalTurn[]) => prev.map((t: LocalTurn, i: number) =>
        i === prev.length - 1 ? { ...t, latency_ms: totalLatency } : t
      ));
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
      await logTurn('assistant', `[${method} confirm] ${msg}`);
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
      await logTurn('assistant', 'Cancelled.');
      await speakThenMaybeListen('Cancelled.', 'done');
    } else {
      setTranscript('');
      setVoiceState('idle');
    }
  };

  // ── Mic / call controls ─────────────────────────────────────────────────────

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
    turnStartRef.current = Date.now();

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
        stopCall();
        return;
      }

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

  const startCall = async () => {
    setCallState('connecting');
    setErrorMsg('');
    setExecution(null);
    const s = await startSession();
    if (!s) {
      setCallState('inactive');
      setErrorMsg('Could not create voice session.');
      return;
    }
    setCallState('active');
    startListening();
  };

  const stopCall = async () => {
    setCallState('ending');
    stopListening();
    await endSession();
    setCallState('inactive');
    setVoiceState('idle');
    setExecution(null);
    setTranscript('');
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const formatDuration = (secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
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

  const isCallActive = callState === 'active' || callState === 'connecting';

  const patchConfig = async (patch: Partial<VoiceProviderConfig>) => {
    setSavingConfig(true);
    try {
      const updated = await api.updateVoiceConfig(patch);
      setVoiceConfig(updated);
      bargeInEnabledRef.current = updated.reply_style?.barge_in_enabled ?? true;
    } catch { /* non-fatal */ }
    finally { setSavingConfig(false); }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Voice Interface</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Push-to-talk with real command execution. Say &ldquo;confirm&rdquo; or &ldquo;cancel&rdquo; for risky actions.
          </p>
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors mt-1"
          title="Voice settings"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
          {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Provider health strip */}
      <ProviderHealthStrip health={health} loading={healthLoading} onRefresh={refreshHealth} />

      {/* Call card */}
      <div className={clsx(
        'glass-card p-5 mb-5 transition-all',
        isCallActive ? 'border-indigo-700/50' : '',
      )}>
        {/* Session info row */}
        {session && (
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[#1e2847]">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-slate-400 font-mono truncate flex-1">
              session {session.id.slice(0, 8)}…
            </span>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(sessionDuration)}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {session.turn_count} turns
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {session.command_count} cmds
              </span>
            </div>
          </div>
        )}

        {/* Mic / call button */}
        <div className="flex flex-col items-center py-6">
          {!isCallActive ? (
            <button
              onClick={startCall}
              disabled={callState === 'ending'}
              className="w-24 h-24 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 ring-4 ring-indigo-600/20 hover:ring-indigo-600/40 flex items-center justify-center transition-all duration-200"
            >
              {callState === 'ending'
                ? <Loader2 className="w-10 h-10 text-white animate-spin" />
                : <Phone className="w-10 h-10 text-white" />
              }
            </button>
          ) : (
            <div className="flex items-center gap-6">
              {/* Mic toggle */}
              <button
                onClick={voiceState === 'listening' || voiceState === 'speaking' ? stopListening : startListening}
                disabled={voiceState === 'processing'}
                className={clsx(
                  'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200',
                  voiceState === 'listening'
                    ? 'bg-red-600 ring-8 ring-red-600/20 animate-pulse'
                    : voiceState === 'speaking'
                    ? 'bg-emerald-600 ring-8 ring-emerald-600/20 animate-pulse'
                    : voiceState === 'processing'
                    ? 'bg-indigo-700 opacity-70 cursor-not-allowed'
                    : voiceState === 'error'
                    ? 'bg-red-900 hover:bg-red-800 ring-4 ring-red-900/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 ring-4 ring-indigo-600/20',
                )}
              >
                {voiceState === 'listening'
                  ? <MicOff className="w-9 h-9 text-white" />
                  : voiceState === 'processing'
                  ? <Loader2 className="w-9 h-9 text-white animate-spin" />
                  : voiceState === 'speaking'
                  ? <Volume2 className="w-9 h-9 text-white" />
                  : <Mic className="w-9 h-9 text-white" />
                }
              </button>

              {/* Hang up */}
              <button
                onClick={stopCall}
                className="w-14 h-14 rounded-full bg-red-600/80 hover:bg-red-600 ring-4 ring-red-600/20 flex items-center justify-center transition-all duration-200"
                title="End session"
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
            </div>
          )}

          <p className="mt-4 text-sm text-slate-400">
            {callState === 'inactive' && 'Start a voice session'}
            {callState === 'connecting' && 'Starting session…'}
            {callState === 'ending' && 'Ending session…'}
            {callState === 'active' && {
              idle: 'Tap mic to speak',
              listening: 'Listening… tap to stop',
              processing: 'Processing…',
              speaking: 'Speaking… tap to stop',
              done: 'Done — tap mic to speak again',
              error: 'Error — tap to retry',
            }[voiceState]}
          </p>

          {/* Controls row */}
          {isCallActive && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setVoiceReplies((v) => { if (v && 'speechSynthesis' in window) window.speechSynthesis.cancel(); return !v; })}
                title={voiceReplies ? 'Voice replies on' : 'Voice replies off'}
                className="w-8 h-8 rounded-full bg-[#1a2035] border border-[#1e2847] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                {voiceReplies ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setContinuousMode((v) => { if (v) clearTimeout(restartTimerRef.current); return !v; })}
                title={continuousMode ? 'Continuous mode on' : 'Continuous mode off'}
                className={clsx(
                  'w-8 h-8 rounded-full border flex items-center justify-center transition-colors',
                  continuousMode
                    ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/60'
                    : 'bg-[#1a2035] border-[#1e2847] text-slate-400 hover:text-white',
                )}
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Live transcript */}
        {transcript && (
          <div className="bg-[#0d0f14] rounded-lg px-3 py-2 mb-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Transcript</p>
            <p className="text-sm text-white italic">&ldquo;{transcript}&rdquo;</p>
          </div>
        )}

        {/* Execution card */}
        {execution && (
          <div className={clsx(
            'rounded-lg p-3 border',
            execution.status === 'awaiting_confirmation' ? 'bg-amber-950/20 border-amber-800/40' :
            execution.status === 'failed' ? 'bg-red-950/20 border-red-800/40' :
            'bg-emerald-950/20 border-emerald-800/40'
          )}>
            <div className="flex items-center gap-2 mb-1.5">
              {execution.status === 'awaiting_confirmation'
                ? <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                : execution.status === 'failed'
                ? <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                : <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              }
              <span className="text-[10px] text-indigo-400 font-mono">
                {execution.intent || execution.interpreted_intent}
              </span>
              <span className="ml-auto text-[10px] text-slate-500">
                {execution.status}
                {execution.latency_ms ? ` · ${execution.latency_ms}ms` : ''}
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              {execution.status === 'awaiting_confirmation'
                ? (execution.confirmation_message || execution.user_visible_summary)
                : executionSummary(execution)}
            </p>

            {execution.status === 'awaiting_confirmation' && (
              <div className="mt-2.5 flex gap-2 items-center">
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
                <span className="text-[10px] text-slate-500 ml-1">or say &ldquo;confirm&rdquo; / &ldquo;cancel&rdquo;</span>
              </div>
            )}

            {execution.status === 'completed' && execution.execution_result && (
              <div className="mt-1.5 text-[10px] text-emerald-500 font-mono truncate">
                {JSON.stringify(execution.execution_result).slice(0, 120)}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="mt-3 rounded-lg p-2.5 border border-red-900/40 bg-red-950/20">
            <p className="text-xs text-red-400">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Session turn history */}
      {localTurns.length > 0 && (
        <div className="glass-card p-4 mb-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Session Turns
          </h3>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {localTurns.map((turn) => (
              <div key={turn.id} className="flex items-start gap-2.5 text-xs">
                <span className={clsx(
                  'text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5',
                  turn.role === 'user'
                    ? 'bg-indigo-950/60 text-indigo-400'
                    : 'bg-slate-800/60 text-slate-400',
                )}>
                  {turn.role}
                </span>
                <span className="text-slate-300 flex-1 leading-relaxed">{turn.transcript}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {turn.intent && (
                    <span className="text-[9px] text-indigo-400/70 font-mono">{turn.intent}</span>
                  )}
                  {turn.latency_ms && (
                    <span className="text-[9px] text-slate-600">{turn.latency_ms}ms</span>
                  )}
                  {turn.status === 'completed' && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                  {turn.status === 'failed' && <AlertCircle className="w-3 h-3 text-red-400" />}
                  {turn.status === 'awaiting_confirmation' && <AlertCircle className="w-3 h-3 text-amber-400" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 8: Settings panel */}
      {showSettings && voiceConfig && (
        <VoiceSettingsPanel
          config={voiceConfig}
          health={health}
          saving={savingConfig}
          onPatch={patchConfig}
        />
      )}

      {/* Recent voice command history */}
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
                  <p className="text-xs text-white truncate">&ldquo;{entry.text}&rdquo;</p>
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

// ── Voice settings panel (Phase 8) ────────────────────────────────────────────

function VoiceSettingsPanel({
  config,
  health,
  saving,
  onPatch,
}: {
  config: VoiceProviderConfig;
  health: ProvidersHealth | null;
  saving: boolean;
  onPatch: (patch: Partial<VoiceProviderConfig>) => Promise<void>;
}) {
  const [phrase, setPhrase] = useState(config.wake_word?.phrase ?? 'hey jarvis');

  const wakeWordOk = health?.wake_word?.status === 'available';
  const bargeIn = config.reply_style?.barge_in_enabled ?? true;
  const wakeEnabled = config.wake_word?.enabled ?? false;

  return (
    <div className="glass-card p-4 mb-5 space-y-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Settings className="w-4 h-4 text-indigo-400" />
        Voice Settings
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 ml-auto" />}
      </h3>

      {/* Barge-in toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Barge-in interruption
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Speak while Jarvis is replying to interrupt and take over immediately.
          </p>
        </div>
        <button
          onClick={() => onPatch({ reply_style: { ...config.reply_style, barge_in_enabled: !bargeIn } })}
          disabled={saving}
          className={clsx(
            'relative flex-shrink-0 w-10 h-5 rounded-full transition-colors duration-200',
            bargeIn ? 'bg-indigo-600' : 'bg-slate-700',
          )}
        >
          <span className={clsx(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200',
            bargeIn ? 'translate-x-5' : 'translate-x-0',
          )} />
        </button>
      </div>

      <div className="border-t border-[#1e2847]" />

      {/* Wake word toggle */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-white flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-indigo-400" />
            Always-on wake word
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Requires voice-agent running with openWakeWord (docker-compose up voice-agent).
          </p>
        </div>
        <button
          onClick={() => onPatch({ wake_word: { ...config.wake_word, enabled: !wakeEnabled } })}
          disabled={saving}
          className={clsx(
            'relative flex-shrink-0 w-10 h-5 rounded-full transition-colors duration-200',
            wakeEnabled ? 'bg-indigo-600' : 'bg-slate-700',
          )}
        >
          <span className={clsx(
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200',
            wakeEnabled ? 'translate-x-5' : 'translate-x-0',
          )} />
        </button>
      </div>

      {/* Wake phrase + status */}
      {wakeEnabled && (
        <div className="space-y-2 ml-5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              onBlur={() => {
                if (phrase.trim() && phrase !== config.wake_word?.phrase) {
                  onPatch({ wake_word: { ...config.wake_word, phrase: phrase.trim() } });
                }
              }}
              className="bg-[#0d0f14] border border-[#1e2847] rounded-lg px-3 py-1.5 text-xs text-white w-48 focus:outline-none focus:border-indigo-700"
              placeholder="hey jarvis"
            />
            <span className={clsx(
              'text-[10px] px-2 py-0.5 rounded-full font-medium',
              wakeWordOk
                ? 'bg-emerald-950/60 text-emerald-400'
                : 'bg-amber-950/60 text-amber-400',
            )}>
              {wakeWordOk ? '✓ Detected' : 'Not running'}
            </span>
          </div>
          {!wakeWordOk && (
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Start the local voice stack: <code className="font-mono text-slate-400">docker compose -f infra/docker-compose.voice.yml up</code>
            </p>
          )}
        </div>
      )}

      {/* STT provider selector */}
      <div className="border-t border-[#1e2847]" />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-white">STT provider</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {config.stt?.provider === 'whisper_cpp'
              ? `whisper.cpp at ${config.stt?.base_url ?? 'http://localhost:8178'}`
              : 'Browser Web Speech API (Chrome/Edge only)'}
          </p>
        </div>
        <select
          value={config.stt?.provider ?? 'browser'}
          onChange={(e) => onPatch({ stt: { ...config.stt, provider: e.target.value } })}
          disabled={saving}
          className="bg-[#0d0f14] border border-[#1e2847] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-700 disabled:opacity-50"
        >
          <option value="browser">browser</option>
          <option value="whisper_cpp">whisper_cpp</option>
          <option value="groq">groq</option>
        </select>
      </div>

      {/* TTS provider selector */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-white">TTS provider</p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {config.tts?.provider === 'piper'
              ? `Piper at ${config.tts?.base_url ?? 'http://localhost:5002'}`
              : 'Browser SpeechSynthesis (built-in)'}
          </p>
        </div>
        <select
          value={config.tts?.provider ?? 'browser'}
          onChange={(e) => onPatch({ tts: { ...config.tts, provider: e.target.value } })}
          disabled={saving}
          className="bg-[#0d0f14] border border-[#1e2847] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-700 disabled:opacity-50"
        >
          <option value="browser">browser</option>
          <option value="piper">piper</option>
        </select>
      </div>
    </div>
  );
}

// ── Provider health strip ──────────────────────────────────────────────────────

function ProviderHealthStrip({
  health,
  loading,
  onRefresh,
}: {
  health: ProvidersHealth | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  type ProviderKey = Exclude<keyof ProvidersHealth, 'overall'>;
  const providers: { key: ProviderKey; label: string }[] = [
    { key: 'browser_stt', label: 'Browser STT' },
    { key: 'whisper_cpp', label: 'Whisper' },
    { key: 'piper', label: 'Piper TTS' },
    { key: 'ollama', label: 'Ollama' },
    { key: 'livekit', label: 'LiveKit' },
    { key: 'wake_word', label: 'Wake Word' },
  ];

  return (
    <div className="glass-card px-4 py-3 mb-5 flex items-center gap-3 flex-wrap">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Providers</span>
      {providers.map(({ key, label }) => {
        const p = health?.[key];
        const status = p?.status ?? (loading ? 'checking' : 'unknown');
        return (
          <ProviderDot key={key} label={label} status={status} />
        );
      })}
      {health && (
        <span className={clsx(
          'ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium',
          health.overall === 'ok' ? 'bg-emerald-950/60 text-emerald-400' :
          health.overall === 'degraded' ? 'bg-amber-950/60 text-amber-400' :
          'bg-red-950/60 text-red-400',
        )}>
          {health.overall}
        </span>
      )}
      <button
        onClick={onRefresh}
        disabled={loading}
        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-white transition-colors disabled:opacity-40"
        title="Refresh provider health"
      >
        {loading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <RotateCw className="w-3.5 h-3.5" />
        }
      </button>
    </div>
  );
}

function ProviderDot({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${status}`}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', {
        'bg-emerald-400': status === 'available',
        'bg-red-400': status === 'unavailable' || status === 'error',
        'bg-amber-400 animate-pulse': status === 'checking',
        'bg-slate-600': status === 'unknown' || status === 'disabled',
      })} />
      <span className="text-[9px] text-slate-500">{label}</span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function executionSpeechText(result: CommandExecution): string {
  if (result.status === 'failed') return result.error_message || 'Command failed.';
  if (result.status === 'completed') {
    const r = result.execution_result;
    if (r?.title) return `Done. Created task: ${r.title}`;
    if (r?.status === 'completed') return 'Task marked as complete.';
    if (r?.status === 'deferred') return 'Task deferred.';
    if (r?.status === 'waiting') return 'Task marked as waiting.';
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
    if (r?.status === 'deferred') return 'Deferred task';
    if (r?.count !== undefined) return `${r.count} tasks today`;
    return result.user_visible_summary || 'Done.';
  }
  return result.user_visible_summary || 'Command received.';
}
