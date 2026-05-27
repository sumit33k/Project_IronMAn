'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Mic, Volume2, VolumeX, RotateCw } from 'lucide-react';
import { useStore } from '@/stores/useStore';

type JarvisState = 'boot' | 'listening' | 'processing' | 'speaking' | 'done' | 'error';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const NUM_BARS = 28;

function commandSummary(value: unknown, fallback = 'Command received.'): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return fallback;

  const record = value as Record<string, unknown>;
  return commandSummary(record.user_visible_summary ?? record.intent, fallback);
}

export default function JarvisOverlay() {
  const { jarvisOpen, setJarvisOpen } = useStore();
  const [state, setState] = useState<JarvisState>('boot');
  const [transcript, setTranscript] = useState('');
  const [resultText, setResultText] = useState('');
  const [bars, setBars] = useState<number[]>(Array(NUM_BARS).fill(3));
  const [sttProvider, setSttProvider] = useState<string>('browser');
  const [voiceReplies, setVoiceReplies] = useState(true);
  const [continuousMode, setContinuousMode] = useState(true);

  const recognitionRef = useRef<unknown>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const finalRef = useRef('');
  const ignoreNextEndRef = useRef(false);
  const closingRef = useRef(false);
  const barTimer = useRef<ReturnType<typeof setInterval>>();
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout>>();
  const restartTimer = useRef<ReturnType<typeof setTimeout>>();
  const mediaStopTimer = useRef<ReturnType<typeof setTimeout>>();

  const close = useCallback(() => {
    closingRef.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognitionRef.current as any)?.abort();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    clearInterval(barTimer.current);
    clearTimeout(autoCloseTimer.current);
    clearTimeout(restartTimer.current);
    clearTimeout(mediaStopTimer.current);
    setJarvisOpen(false);
    setState('boot');
    setTranscript('');
    setResultText('');
    finalRef.current = '';
  }, [setJarvisOpen]);

  // Load voice settings on mount to know which STT provider to use
  useEffect(() => {
    fetch(`${API}/voice/settings`)
      .then((r) => r.json())
      .then((s) => {
        if (s?.stt_provider) setSttProvider(s.stt_provider);
        if (typeof s?.tts_enabled === 'boolean') setVoiceReplies(s.tts_enabled);
      })
      .catch(() => {});
  }, []);

  // animate bars while listening
  useEffect(() => {
    if (state === 'listening') {
      barTimer.current = setInterval(() => {
        setBars(
          Array(NUM_BARS)
            .fill(0)
            .map(() => Math.floor(Math.random() * 44) + 4)
        );
      }, 80);
    } else {
      clearInterval(barTimer.current);
      setBars(Array(NUM_BARS).fill(3));
    }
    return () => clearInterval(barTimer.current);
  }, [state]);

  // start recognition when overlay opens
  useEffect(() => {
    if (!jarvisOpen) return;
    closingRef.current = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    clearTimeout(restartTimer.current);
    clearTimeout(autoCloseTimer.current);
    setState('boot');
    setTranscript('');
    setResultText('');
    finalRef.current = '';

    const t = setTimeout(() => startListening(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jarvisOpen]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const chooseVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => /samantha|alex|google us english|microsoft aria/i.test(v.name)) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
      null
    );
  };

  const speak = (text: string): Promise<boolean> => new Promise((resolve) => {
    if (!voiceReplies || typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
      resolve(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = chooseVoice();
    utterance.rate = 0.98;
    utterance.pitch = 0.96;
    utterance.volume = 1;
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.resume();
  });

  const queueNextListen = (delay = 650) => {
    if (!continuousMode || closingRef.current) return;
    clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => {
      if (closingRef.current) return;
      setState('boot');
      setTranscript('');
      setResultText('');
      finalRef.current = '';
      startListening();
    }, delay);
  };

  const respond = async (text: string, nextState: Extract<JarvisState, 'done' | 'error'> = 'done') => {
    setResultText(text);
    if (voiceReplies && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setState('speaking');
      await speak(text);
    }
    if (closingRef.current) return;
    if (nextState === 'done' && continuousMode) {
      queueNextListen();
      return;
    }
    setState(nextState);
  };

  const isStopCommand = (text: string): boolean => {
    const normalized = text.trim().toLowerCase();
    return [
      'stop listening',
      'stop jarvis',
      'close jarvis',
      'close voice',
      'cancel voice',
      'exit voice',
      'goodbye jarvis',
    ].some((phrase) => normalized.includes(phrase));
  };

  const sendCommand = async (text: string) => {
    if (!text.trim()) {
      setState('boot');
      setTranscript('');
      queueNextListen();
      return;
    }

    if (isStopCommand(text)) {
      await respond('Okay, I will stop listening now.', 'done');
      close();
      return;
    }

    setState('processing');
    try {
      const res = await fetch(`${API}/commands/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_input: text, input_mode: 'voice' }),
      });
      const data = await res.json() as Record<string, unknown>;
      await respond(commandSummary(data));
    } catch {
      await respond('Backend offline. I heard you, but I could not send the command.', 'error');
    }
  };

  const startListeningWithMediaRecorder = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setResultText('Microphone access denied.');
      setState('error');
      return;
    }
    audioChunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (closingRef.current) return;
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (blob.size < 1000) {
        setState('boot');
        setTranscript('');
        queueNextListen();
        return;
      }
      setState('processing');
      const fd = new FormData();
      fd.append('audio', blob, 'recording.webm');
      try {
        const res = await fetch(`${API}/voice/transcribe`, { method: 'POST', body: fd });
        const data = await res.json();
        const text = data.transcript || '';
        setTranscript(text);
        finalRef.current = text;
        await sendCommand(text);
      } catch {
        await respond('Transcription failed. Please try again.', 'error');
      }
    };
    setState('listening');
    mr.start();
    // Auto-stop after 10 seconds silence window; user can also click the mic button
    mediaStopTimer.current = setTimeout(() => { if (mr.state === 'recording') mr.stop(); }, 10000);
  };

  function startListeningBrowser() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      void respond('Speech recognition is unavailable. Switch to server transcription in voice settings.', 'error');
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any;
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recognitionRef.current = rec;
    ignoreNextEndRef.current = false;
    rec.onstart = () => setState('listening');
    rec.onresult = (e: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ev = e as any;
      const t = Array.from(ev.results as unknown[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript).join('');
      setTranscript(t);
      finalRef.current = t;
    };

    rec.onend = async () => {
      if (ignoreNextEndRef.current) {
        ignoreNextEndRef.current = false;
        return;
      }
      if (closingRef.current) return;
      if (!finalRef.current.trim()) {
        setState('boot');
        setTranscript('');
        queueNextListen(450);
        return;
      }
      await sendCommand(finalRef.current);
    };

    rec.onerror = (event: { error?: string }) => {
      if (closingRef.current || event.error === 'aborted') return;
      if (event.error === 'no-speech') return;
      ignoreNextEndRef.current = true;
      void respond('Microphone access was denied or unavailable.', 'error');
    };

    rec.start();
  }

  function startListening() {
    if (closingRef.current) return;
    clearTimeout(restartTimer.current);
    clearTimeout(autoCloseTimer.current);
    finalRef.current = '';
    ignoreNextEndRef.current = false;
    if (sttProvider !== 'browser') {
      startListeningWithMediaRecorder();
    } else {
      startListeningBrowser();
    }
  }

  const toggleVoiceReplies = () => {
    setVoiceReplies((value) => {
      const next = !value;
      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const toggleContinuousMode = () => {
    setContinuousMode((value) => {
      const next = !value;
      if (!next) clearTimeout(restartTimer.current);
      return next;
    });
  };

  const ringVariants = {
    animate: (i: number) => ({
      scale: [1, 1.6 + i * 0.25],
      opacity: [0.5, 0],
      transition: {
        duration: 1.8 + i * 0.3,
        repeat: Infinity,
        ease: 'easeOut',
        delay: i * 0.4,
      },
    }),
  };

  const stateLabel: Record<JarvisState, string> = {
    boot: 'Initialising…',
    listening: 'Listening…',
    processing: 'Processing…',
    speaking: 'Speaking…',
    done: 'Got it.',
    error: 'Error',
  };

  const stateColor: Record<JarvisState, string> = {
    boot: '#6366f1',
    listening: '#3b82f6',
    processing: '#a855f7',
    speaking: '#10b981',
    done: '#10b981',
    error: '#ef4444',
  };

  return (
    <AnimatePresence>
      {jarvisOpen && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          style={{ background: 'rgba(5,7,14,0.93)', backdropFilter: 'blur(20px)' }}
        >
          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.015) 2px,rgba(255,255,255,0.015) 4px)',
            }}
          />

          {/* Close */}
          <button
            onClick={close}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ESC hint */}
          <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] text-slate-600 tracking-widest uppercase">
            Press <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-slate-500">ESC</kbd> to dismiss
          </span>

          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <button
              onClick={toggleVoiceReplies}
              title={voiceReplies ? 'Voice replies on' : 'Voice replies off'}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              {voiceReplies ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleContinuousMode}
              title={continuousMode ? 'Continuous conversation on' : 'Continuous conversation off'}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                continuousMode
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Center content */}
          <div className="relative flex flex-col items-center gap-6 select-none">
            {/* Pulse rings */}
            {state === 'listening' && [0, 1, 2].map((i) => (
              <motion.div
                key={i}
                custom={i}
                variants={ringVariants}
                animate="animate"
                className="absolute rounded-full border border-blue-500/30"
                style={{ width: 120, height: 120 }}
              />
            ))}

            {/* Core circle */}
            <motion.div
              className="relative w-[120px] h-[120px] rounded-full flex items-center justify-center"
              animate={state === 'listening' ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
              style={{
                background: `radial-gradient(circle at 40% 35%, ${stateColor[state]}33 0%, ${stateColor[state]}11 60%, transparent 100%)`,
                border: `2px solid ${stateColor[state]}55`,
                boxShadow: `0 0 40px ${stateColor[state]}33, 0 0 80px ${stateColor[state]}11`,
              }}
            >
              {state === 'processing' ? (
                <motion.div
                  className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-400 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                />
              ) : state === 'speaking' ? (
                <motion.div
                  animate={{ scale: [1, 1.12, 1] }}
                  transition={{ repeat: Infinity, duration: 0.9 }}
                >
                  <Volume2 className="w-10 h-10 text-emerald-400" />
                </motion.div>
              ) : state === 'done' ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-4xl"
                >
                  ✓
                </motion.div>
              ) : (
                <motion.div
                  animate={state === 'listening' ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 0.9 }}
                >
                  {state === 'error' ? (
                    <Mic className="w-10 h-10 text-red-400" />
                  ) : (
                    <Zap className="w-10 h-10" style={{ color: stateColor[state] }} />
                  )}
                </motion.div>
              )}
            </motion.div>

            {/* State label */}
            <div className="text-center">
              <motion.p
                key={state}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xl font-bold tracking-widest uppercase"
                style={{ color: stateColor[state], letterSpacing: '0.2em' }}
              >
                JARVIS
              </motion.p>
              <motion.p
                key={state + '-label'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm tracking-wider mt-1"
                style={{ color: stateColor[state] + 'bb' }}
              >
                {stateLabel[state]}
              </motion.p>
            </div>

            {/* Audio bars */}
            <AnimatePresence>
              {state === 'listening' && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0 }}
                  className="flex items-end gap-[3px]"
                  style={{ height: 48 }}
                >
                  {bars.map((h, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: h }}
                      transition={{ duration: 0.08, ease: 'easeOut' }}
                      className="w-[3px] rounded-full"
                      style={{
                        background: `hsl(${220 + i * 2}, 80%, ${50 + i}%)`,
                        minHeight: 3,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Transcript / result */}
            <div className="w-[400px] max-w-[90vw] text-center min-h-[48px]">
              <AnimatePresence mode="wait">
                {(transcript || resultText) && (
                  <motion.p
                    key={transcript + resultText}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm leading-relaxed"
                    style={{
                      color: state === 'done' || state === 'speaking' ? '#10b981' : state === 'error' ? '#ef4444' : '#94a3b8',
                    }}
                  >
                    {state === 'done' || state === 'speaking' || state === 'error' ? resultText : `"${transcript}"`}
                  </motion.p>
                )}
                {state === 'boot' && !transcript && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-xs text-slate-600 tracking-widest uppercase"
                  >
                    Speak your command…
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Stop recording button for server-side STT */}
            <AnimatePresence>
              {state === 'listening' && sttProvider !== 'browser' && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => mediaRecorderRef.current?.stop()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-medium transition-all bg-blue-500/10 hover:bg-blue-500/20"
                  style={{ borderColor: '#3b82f655', color: '#3b82f6' }}
                >
                  <Mic className="w-4 h-4" /> Done — send command
                </motion.button>
              )}
            </AnimatePresence>

            {/* Mic re-trigger button (after done/error) */}
            <AnimatePresence>
              {((state === 'done' && !continuousMode) || state === 'error') && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => { setState('boot'); setTranscript(''); setResultText(''); setTimeout(startListening, 300); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all hover:bg-white/5"
                  style={{ borderColor: stateColor[state] + '55', color: stateColor[state] }}
                >
                  <Mic className="w-4 h-4" /> Ask again
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
