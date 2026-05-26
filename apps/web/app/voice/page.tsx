'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle, Volume2, History } from 'lucide-react';
import { useStore } from '@/stores/useStore';
import { api, type CommandResult, type VoiceHistoryRecord } from '@/lib/api';
import { clsx } from 'clsx';

type VoiceState = 'idle' | 'listening' | 'processing' | 'done' | 'error';

export default function VoicePage() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<CommandResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [history, setHistory] = useState<VoiceHistoryRecord[]>([]);
  const recognitionRef = useRef<unknown>(null);
  const finalTranscriptRef = useRef('');
  const { routeCommand } = useStore();

  useEffect(() => {
    api.getVoiceHistory()
      .then((data) => setHistory(data.slice(0, 5)))
      .catch(() => {
        // History endpoint may not exist yet — fail silently
      });
  }, []);

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg('Browser speech recognition not available. Please use Chrome or Edge.');
      setVoiceState('error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    setVoiceState('listening');
    setTranscript('');
    setResult(null);
    setErrorMsg('');
    setConfirmed(false);
    finalTranscriptRef.current = '';

    recognition.onresult = (e: any) => {
      const t = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript)
        .join('');
      setTranscript(t);
      finalTranscriptRef.current = t;
    };

    recognition.onend = async () => {
      const final = finalTranscriptRef.current;
      if (!final.trim()) { setVoiceState('idle'); return; }

      setVoiceState('processing');
      try {
        const r = await routeCommand(final);
        setResult(r);
        setVoiceState('done');
        // Refresh history after a new command
        api.getVoiceHistory()
          .then((data) => setHistory(data.slice(0, 5)))
          .catch(() => {});
      } catch {
        setErrorMsg('Failed to process command. Is the API running?');
        setVoiceState('error');
      }
    };

    recognition.onerror = (e: any) => {
      setErrorMsg(`Recognition error: ${e.error}`);
      setVoiceState('error');
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    (recognitionRef.current as any)?.stop();
    setVoiceState('idle');
  };

  const handleConfirm = () => {
    setConfirmed(true);
  };

  const handleCancel = () => {
    setResult(null);
    setTranscript('');
    setConfirmed(false);
    finalTranscriptRef.current = '';
    setVoiceState('idle');
  };

  const parseIntent = (routingResult: unknown): string => {
    if (routingResult === null || routingResult === undefined) return 'unknown';
    if (typeof routingResult === 'object') {
      const obj = routingResult as Record<string, unknown>;
      return String(obj.intent ?? 'unknown');
    }
    try {
      const parsed: unknown = JSON.parse(String(routingResult));
      if (parsed !== null && typeof parsed === 'object') {
        return String((parsed as Record<string, unknown>).intent ?? 'unknown');
      }
      return String(parsed ?? 'unknown');
    } catch {
      return String(routingResult);
    }
  };

  const formatTimestamp = (iso: string): string => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const buttonLabel: Record<VoiceState, string> = {
    idle: 'Click to speak',
    listening: 'Listening… click to stop',
    processing: 'Processing…',
    done: 'Done! Click to speak again',
    error: 'Error — click to retry',
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Voice Interface</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Push-to-talk voice commands. &quot;Hey Jarvis&quot; always-on mode coming in Phase 4.
        </p>
      </div>

      {/* Mic button */}
      <div className="flex flex-col items-center py-10">
        <button
          onClick={voiceState === 'listening' ? stopListening : startListening}
          disabled={voiceState === 'processing'}
          className={clsx(
            'w-28 h-28 rounded-full flex items-center justify-center transition-all duration-200',
            voiceState === 'listening'
              ? 'bg-red-600 ring-8 ring-red-600/20 animate-pulse'
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
            : <Mic className="w-12 h-12 text-white" />
          }
        </button>
        <p className="mt-4 text-sm text-slate-400">{buttonLabel[voiceState]}</p>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="glass-card p-4 mb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">You said</p>
          <p className="text-sm text-white italic">&quot;{transcript}&quot;</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={clsx('glass-card p-4 mb-4', result.requires_confirmation ? 'border-amber-800/40' : 'border-emerald-800/40')}>
          <div className="flex items-center gap-2 mb-2">
            {result.requires_confirmation
              ? <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              : <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            }
            <p className="text-xs font-medium text-white">
              Intent: <span className="text-indigo-400 font-mono">{String(result.intent)}</span>
            </p>
            <span className="ml-auto text-[10px] text-slate-500">
              {Math.round(Number(result.confidence) * 100)}% confidence
            </span>
          </div>
          <p className="text-sm text-slate-200">{String(result.user_visible_summary)}</p>
          {!!result.requires_confirmation && (
            <div className="mt-3 flex gap-2 items-center">
              {confirmed ? (
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Command confirmed. Jarvis will execute this when the integration is ready.
                </p>
              ) : (
                <>
                  <button
                    onClick={handleConfirm}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs text-white font-medium transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1.5 bg-[#1a2035] hover:bg-[#1e2847] rounded-lg text-xs text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
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

      {/* Wake word section */}
      <div className="glass-card p-4 mb-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-indigo-400" />
          Wake Word Settings
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white">Always-on &quot;Hey Jarvis&quot;</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Uses openWakeWord for local detection</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 rounded-full font-medium">
              Phase 4 — Coming Soon
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white">Local STT (whisper.cpp)</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Offline speech-to-text</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-purple-950/60 text-purple-400 border border-purple-800/40 rounded-full font-medium">
              Phase 4+
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white">Push-to-talk (Browser API)</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Uses browser SpeechRecognition</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 rounded-full font-medium">
              ✓ Active
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
