'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Mic,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Zap,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const TOTAL_STEPS = 6;

const MODEL_PRESETS = [
  { id: 'llama3.1', label: 'llama3.1', desc: 'Best quality (4.7 GB, needs 8GB RAM)' },
  { id: 'mistral', label: 'mistral', desc: 'Good balance (4.1 GB)' },
  { id: 'phi3', label: 'phi3', desc: 'Fast & light (2.3 GB, 4GB RAM)' },
  { id: 'qwen2.5:3b', label: 'qwen2.5:3b', desc: 'Lightest (1.9 GB)' },
];

interface FormState {
  user_name: string;
  ollama_model: string;
  voice_enabled: boolean;
  approval_policy: string;
  cloud_provider_enabled: boolean;
  cloud_provider: string;
  cloud_api_key: string;
  data_sharing_acknowledged: boolean;
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [models, setModels] = useState<string[]>([]);
  const [customModel, setCustomModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    user_name: '',
    ollama_model: 'llama3.1',
    voice_enabled: false,
    approval_policy: 'always_for_risky',
    cloud_provider_enabled: false,
    cloud_provider: 'none',
    cloud_api_key: '',
    data_sharing_acknowledged: false,
  });

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const checkOllama = useCallback(async () => {
    setOllamaStatus('checking');
    try {
      const res = await fetch(`${API}/ai/health`);
      const data = await res.json();
      if (data.ollama_available) {
        setOllamaStatus('ok');
        setModels(Array.isArray(data.models) ? data.models : []);
      } else {
        setOllamaStatus('error');
      }
    } catch {
      setOllamaStatus('error');
    }
  }, []);

  useEffect(() => {
    if (step === 1) {
      void checkOllama();
    }
  }, [step, checkOllama]);

  const transitionTo = (next: number) => {
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
    }, 180);
  };

  const handleNext = () => {
    if (step === 5) {
      void handleFinish();
    } else {
      transitionTo(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) transitionTo(step - 1);
  };

  const handleSkip = async () => {
    try {
      await fetch(`${API}/settings/complete-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: '',
          ollama_model: 'llama3.1',
          voice_enabled: false,
          approval_policy: 'always_for_risky',
          cloud_provider_enabled: false,
          cloud_provider: 'none',
          cloud_api_key: '',
          data_sharing_acknowledged: false,
        }),
      });
    } catch {
      // ignore
    }
    router.push('/');
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (customModel.trim()) {
        payload.ollama_model = customModel.trim();
      }
      await fetch(`${API}/settings/complete-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      transitionTo(6);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const nextDisabled = () => {
    if (step === 3 && !form.user_name.trim()) return true;
    if (saving) return true;
    return false;
  };

  return (
    <div className="fixed inset-0 bg-[#0d0f14] z-50 flex flex-col items-center justify-center px-4 overflow-y-auto py-8">
      {/* Step dots */}
      {step < 6 && (
        <div className="flex items-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i < step
                  ? 'w-2 h-2 bg-indigo-500'
                  : i === step
                  ? 'w-3 h-3 bg-indigo-400 ring-2 ring-indigo-400/30'
                  : 'w-2 h-2 bg-[#1e2847]'
              }`}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {step < 6 && (
        <div className="w-full max-w-xl mb-6 h-0.5 bg-[#1e2847] rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${((step) / (TOTAL_STEPS - 1)) * 100}%` }}
          />
        </div>
      )}

      {/* Card */}
      <div
        className={`w-full max-w-xl bg-[#131720] border border-[#1e2847] rounded-2xl p-8 shadow-2xl transition-all duration-200 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        {step === 0 && <StepWelcome />}
        {step === 1 && (
          <StepRequirements
            ollamaStatus={ollamaStatus}
            models={models}
            onRecheck={checkOllama}
          />
        )}
        {step === 2 && (
          <StepModel
            form={form}
            models={models}
            ollamaStatus={ollamaStatus}
            customModel={customModel}
            setCustomModel={setCustomModel}
            setField={setField}
          />
        )}
        {step === 3 && (
          <StepProfile form={form} setField={setField} />
        )}
        {step === 4 && (
          <StepPreferences form={form} setField={setField} />
        )}
        {step === 5 && (
          <StepVoiceCloud form={form} setField={setField} />
        )}
        {step === 6 && (
          <StepComplete form={form} customModel={customModel} onLaunch={() => router.push('/')} />
        )}
      </div>

      {/* Nav buttons */}
      {step < 6 && (
        <div className="flex items-center justify-between w-full max-w-xl mt-6">
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a2035] border border-[#1e2847] text-sm text-slate-300 hover:border-indigo-700/60 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleSkip}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-2"
            >
              Skip setup
            </button>
          </div>
          <button
            onClick={handleNext}
            disabled={nextDisabled()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : step === 5 ? (
              <>
                Finish
                <ChevronRight className="w-4 h-4" />
              </>
            ) : step === 0 ? (
              <>
                Get Started
                <ChevronRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function StepWelcome() {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-900/40">
          <Zap className="w-10 h-10 text-white" />
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Welcome to Jarvis Command Center</h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Your local-first AI productivity cockpit. All data stays on your device. No cloud required.
        </p>
      </div>
      <ul className="text-left space-y-3 max-w-sm mx-auto">
        {[
          ['⚡', 'Local AI via Ollama', 'All inference runs on your machine'],
          ['🛡️', 'Human-in-the-loop safety gates', 'You approve risky actions before they run'],
          ['🤖', 'Modular AI agents', 'Task, email, calendar agents — all local'],
        ].map(([icon, title, desc]) => (
          <li key={title} className="flex items-start gap-3 p-3 rounded-xl bg-[#0d0f14] border border-[#1e2847]">
            <span className="text-lg leading-none mt-0.5">{icon}</span>
            <div>
              <p className="text-sm font-medium text-white">{title}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepRequirements({
  ollamaStatus,
  models,
  onRecheck,
}: {
  ollamaStatus: 'checking' | 'ok' | 'error';
  models: string[];
  onRecheck: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Requirements Check</h2>
        <p className="text-sm text-slate-400">Let&apos;s make sure everything is ready.</p>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-[#0d0f14] border border-[#1e2847]">
        {ollamaStatus === 'checking' ? (
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin flex-shrink-0" />
        ) : ollamaStatus === 'ok' ? (
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${
            ollamaStatus === 'ok' ? 'text-emerald-400' :
            ollamaStatus === 'error' ? 'text-red-400' :
            'text-slate-400'
          }`}>
            {ollamaStatus === 'checking' ? 'Checking Ollama…' :
             ollamaStatus === 'ok' ? 'Ollama is running' :
             'Ollama not detected'}
          </p>
          {ollamaStatus === 'ok' && models.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {models.length} model{models.length !== 1 ? 's' : ''} available: {models.join(', ')}
            </p>
          )}
        </div>
        <button
          onClick={onRecheck}
          className="text-slate-500 hover:text-indigo-400 transition-colors flex-shrink-0"
          title="Recheck"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {ollamaStatus === 'error' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">Start Ollama with:</p>
          <pre className="p-3 rounded-lg bg-[#0a0c10] border border-[#1e2847] text-xs text-emerald-300 font-mono overflow-x-auto">
            ollama serve
          </pre>
          <p className="text-xs text-slate-500">
            You can continue without Ollama and configure it later in Settings.
          </p>
        </div>
      )}

      {ollamaStatus === 'ok' && (
        <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/30">
          <p className="text-xs text-emerald-300">
            Ollama is running and ready. You can choose a model in the next step.
          </p>
        </div>
      )}
    </div>
  );
}

function StepModel({
  form,
  models,
  ollamaStatus,
  customModel,
  setCustomModel,
  setField,
}: {
  form: FormState;
  models: string[];
  ollamaStatus: 'checking' | 'ok' | 'error';
  customModel: string;
  setCustomModel: (v: string) => void;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const availableModels = ollamaStatus === 'ok' && models.length > 0 ? models : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Choose Your AI Model</h2>
        <p className="text-sm text-slate-400">This model will power Jarvis&apos;s AI features.</p>
      </div>

      {availableModels && (
        <div className="p-3 rounded-xl bg-[#0d0f14] border border-[#1e2847]">
          <p className="text-xs text-slate-500 mb-2">Detected on your system:</p>
          <div className="flex flex-wrap gap-1.5">
            {availableModels.map((m) => (
              <button
                key={m}
                onClick={() => { setField('ollama_model', m); setCustomModel(''); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                  form.ollama_model === m && !customModel
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#1a2035] text-slate-300 hover:border-indigo-700/60 border border-[#1e2847]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Preset models</p>
        {MODEL_PRESETS.map((preset) => (
          <label
            key={preset.id}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              form.ollama_model === preset.id && !customModel
                ? 'bg-indigo-950/30 border-indigo-600/60'
                : 'bg-[#0d0f14] border-[#1e2847] hover:border-indigo-700/40'
            }`}
          >
            <input
              type="radio"
              name="model"
              value={preset.id}
              checked={form.ollama_model === preset.id && !customModel}
              onChange={() => { setField('ollama_model', preset.id); setCustomModel(''); }}
              className="mt-0.5 accent-indigo-500"
            />
            <div>
              <p className="text-sm font-medium text-white font-mono">{preset.label}</p>
              <p className="text-xs text-slate-500">{preset.desc}</p>
            </div>
          </label>
        ))}
      </div>

      <div>
        <label className="block">
          <span className="text-xs text-slate-400 mb-1.5 block">Or enter a custom model name</span>
          <input
            type="text"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="e.g. llama3.2:latest"
            className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
          />
        </label>
      </div>
    </div>
  );
}

function StepProfile({
  form,
  setField,
}: {
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Your Profile</h2>
        <p className="text-sm text-slate-400">Jarvis will use this in briefings and greetings.</p>
      </div>

      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <span className="text-2xl">
            {form.user_name.trim() ? form.user_name.trim()[0].toUpperCase() : '?'}
          </span>
        </div>
      </div>

      <label className="block">
        <span className="text-sm text-slate-300 mb-2 block">What should Jarvis call you?</span>
        <input
          type="text"
          value={form.user_name}
          onChange={(e) => setField('user_name', e.target.value)}
          placeholder="Your name"
          autoFocus
          className="w-full bg-[#1a2035] border border-[#1e2847] rounded-xl px-4 py-3 text-base text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {!form.user_name.trim() && (
          <p className="text-xs text-slate-600 mt-1.5">Required to continue</p>
        )}
      </label>
    </div>
  );
}

function StepPreferences({
  form,
  setField,
}: {
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Preferences</h2>
        <p className="text-sm text-slate-400">How should Jarvis handle autonomous actions?</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Approval Policy</p>
        {[
          {
            value: 'always_for_risky',
            label: 'Always confirm risky actions',
            desc: 'Recommended — require approval for email sends, deletions, and calendar writes',
            badge: 'Recommended',
          },
          {
            value: 'auto',
            label: 'Auto-execute low-risk, confirm high-risk',
            desc: 'Low-risk tasks run automatically; destructive actions still need approval',
            badge: null,
          },
        ].map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
              form.approval_policy === opt.value
                ? 'bg-indigo-950/30 border-indigo-600/60'
                : 'bg-[#0d0f14] border-[#1e2847] hover:border-indigo-700/40'
            }`}
          >
            <input
              type="radio"
              name="approval_policy"
              value={opt.value}
              checked={form.approval_policy === opt.value}
              onChange={() => setField('approval_policy', opt.value)}
              className="mt-1 accent-indigo-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{opt.label}</p>
                {opt.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-900/50 text-indigo-300 border border-indigo-700/40">
                    {opt.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-[#0d0f14] border border-[#1e2847]">
        <div className="w-3 h-3 rounded-full bg-indigo-500 flex-shrink-0" />
        <div>
          <p className="text-sm text-white">Dark theme</p>
          <p className="text-xs text-slate-500">Dark mode is active — it&apos;s the only theme for now</p>
        </div>
      </div>
    </div>
  );
}

function StepVoiceCloud({
  form,
  setField,
}: {
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Voice &amp; Cloud AI</h2>
        <p className="text-sm text-slate-400">Optional features — all off by default.</p>
      </div>

      <div className="p-4 rounded-xl bg-[#0d0f14] border border-[#1e2847]">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-white">Push-to-talk voice commands</p>
              <p className="text-xs text-slate-500">Hold a key and speak to control Jarvis</p>
            </div>
          </div>
          <button
            onClick={() => setField('voice_enabled', !form.voice_enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              form.voice_enabled ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                form.voice_enabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </label>
      </div>

      <div className="border-t border-[#1e2847] pt-5">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Cloud AI (optional)</p>

        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={form.cloud_provider_enabled}
            onChange={(e) => setField('cloud_provider_enabled', e.target.checked)}
            className="w-4 h-4 rounded accent-indigo-600"
          />
          <div>
            <p className="text-sm text-white">I want to use a cloud AI provider</p>
            <p className="text-xs text-slate-500">Sends prompts to an external server — optional</p>
          </div>
        </label>

        {form.cloud_provider_enabled && (
          <div className="space-y-3 pl-7">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Your task context and prompts will be sent to the selected provider.
              </p>
            </div>

            <label className="block">
              <span className="text-xs text-slate-400 mb-1 block">Provider</span>
              <select
                value={form.cloud_provider}
                onChange={(e) => setField('cloud_provider', e.target.value)}
                className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="none">Select provider…</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-slate-400 mb-1 block">API Key</span>
              <input
                type="password"
                value={form.cloud_api_key}
                onChange={(e) => setField('cloud_api_key', e.target.value)}
                placeholder="sk-…"
                className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.data_sharing_acknowledged}
                onChange={(e) => setField('data_sharing_acknowledged', e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-indigo-600 mt-0.5"
              />
              <span className="text-xs text-slate-400">
                I understand that prompts and task data will be sent to the cloud provider
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function StepComplete({
  form,
  customModel,
  onLaunch,
}: {
  form: FormState;
  customModel: string;
  onLaunch: () => void;
}) {
  const effectiveModel = customModel.trim() || form.ollama_model;

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-emerald-950/50 border border-emerald-700/40 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Jarvis is ready</h2>
        <p className="text-sm text-slate-400">Here&apos;s what was configured:</p>
      </div>

      <ul className="text-left space-y-2 text-sm">
        {[
          ['User name', form.user_name || '(not set)'],
          ['AI model', effectiveModel],
          ['Approval policy', form.approval_policy === 'always_for_risky' ? 'Always confirm risky actions' : 'Auto-execute low-risk'],
          ['Voice commands', form.voice_enabled ? 'Enabled' : 'Disabled'],
          ['Cloud AI', form.cloud_provider_enabled ? `Enabled (${form.cloud_provider})` : 'Disabled — local only'],
        ].map(([label, value]) => (
          <li key={label} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-[#0d0f14] border border-[#1e2847]">
            <span className="text-slate-400">{label}</span>
            <span className="text-white font-medium text-right">{value}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-500">
        The app starts empty — start adding your real tasks.
      </p>

      <button
        onClick={onLaunch}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold text-base transition-colors"
      >
        <Zap className="w-5 h-5" />
        Open Jarvis
      </button>
    </div>
  );
}
