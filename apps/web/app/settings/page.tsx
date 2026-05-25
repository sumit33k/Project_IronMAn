'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/stores/useStore';
import { Settings, CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { ollamaAvailable, checkAI } = useStore();

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
    void checkAI();
  }, [checkAI]);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: unknown) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="w-6 h-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-slate-500">Configure your Jarvis Command Center</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Ollama */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Local AI — Ollama</h2>
          <p className="text-xs text-slate-500 mb-4">All AI runs locally on your machine via Ollama.</p>

          <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-[#0d0f14] border border-[#1e2847]">
            {ollamaAvailable
              ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            }
            <span className={`text-xs font-medium ${ollamaAvailable ? 'text-emerald-400' : 'text-red-400'}`}>
              {ollamaAvailable ? 'Ollama is running' : 'Ollama is not available — run: ollama serve'}
            </span>
            <button
              onClick={() => checkAI()}
              className="ml-auto text-slate-500 hover:text-indigo-400 transition-colors"
              title="Recheck"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-slate-400 mb-1 block">Base URL</span>
              <input
                type="text"
                value={String(settings.ollama_base_url ?? 'http://localhost:11434')}
                onChange={(e) => set('ollama_base_url', e.target.value)}
                className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400 mb-1 block">Model</span>
              <input
                type="text"
                value={String(settings.ollama_model ?? 'llama3.1')}
                onChange={(e) => set('ollama_model', e.target.value)}
                className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
            </label>
          </div>
        </section>

        {/* Voice */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Voice &amp; Jarvis</h2>
          <p className="text-xs text-slate-500 mb-4">Configure wake phrase and voice response settings.</p>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-slate-400 mb-1 block">Wake Phrase</span>
              <input
                type="text"
                value={String(settings.wake_phrase ?? 'hey jarvis')}
                onChange={(e) => set('wake_phrase', e.target.value)}
                className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs text-white">Voice Responses (TTS)</p>
                <p className="text-[10px] text-slate-500">Speak agent outputs aloud</p>
              </div>
              <input
                type="checkbox"
                checked={!!settings.tts_enabled}
                onChange={(e) => set('tts_enabled', e.target.checked)}
                className="w-4 h-4 accent-indigo-500 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs text-white">Always-on Wake Word</p>
                <p className="text-[10px] text-slate-500">Phase 4 — not yet available</p>
              </div>
              <input
                type="checkbox"
                disabled
                checked={false}
                className="w-4 h-4 accent-indigo-500 cursor-not-allowed opacity-40"
              />
            </label>
          </div>
        </section>

        {/* Preferences */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Preferences</h2>
          <p className="text-xs text-slate-500 mb-4">Personalize your command center.</p>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-slate-400 mb-1 block">Your Name</span>
              <input
                type="text"
                value={String(settings.user_name ?? 'Sumit')}
                onChange={(e) => set('user_name', e.target.value)}
                className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs text-white">Approval Policy</p>
                <p className="text-[10px] text-slate-500">Always require confirmation for risky actions</p>
              </div>
              <select
                value={String(settings.approval_policy ?? 'always_for_risky')}
                onChange={(e) => set('approval_policy', e.target.value)}
                className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="always_for_risky">Always (risky actions)</option>
                <option value="never">Never (advanced)</option>
              </select>
            </label>
          </div>
        </section>

        {/* Cloud AI Provider */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Cloud AI Provider</h2>
          <p className="text-xs text-slate-500 mb-4">
            Optional. All local AI (Ollama) is used by default. Cloud providers require an API key
            and send data to external servers.
          </p>

          {/* Warning banner — shown when cloud_provider_enabled is true */}
          {!!settings.cloud_provider_enabled && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                Cloud AI is enabled. Your task context and prompts will be sent to the selected provider.
                Disable if you want fully local operation.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {/* Toggle */}
            <label className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Enable Cloud Provider</span>
              <button
                onClick={() => set('cloud_provider_enabled', !settings.cloud_provider_enabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  settings.cloud_provider_enabled ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.cloud_provider_enabled ? 'translate-x-5' : ''
                }`} />
              </button>
            </label>

            {/* Provider select — shown when enabled */}
            {!!settings.cloud_provider_enabled && (
              <>
                <label className="block">
                  <span className="text-xs text-slate-400 mb-1 block">Provider</span>
                  <select
                    value={String(settings.cloud_provider ?? 'none')}
                    onChange={(e) => set('cloud_provider', e.target.value)}
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
                    value={String(settings.cloud_api_key ?? '')}
                    onChange={(e) => set('cloud_api_key', e.target.value)}
                    placeholder="sk-…"
                    className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-400 mb-1 block">Model (optional)</span>
                  <input
                    type="text"
                    value={String(settings.cloud_model ?? '')}
                    onChange={(e) => set('cloud_model', e.target.value)}
                    placeholder="claude-opus-4-7 or gpt-4o"
                    className="w-full bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.data_sharing_acknowledged)}
                    onChange={(e) => set('data_sharing_acknowledged', e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-indigo-600"
                  />
                  <span className="text-xs text-slate-400">
                    I understand that prompts and task data will be sent to the cloud provider
                  </span>
                </label>
              </>
            )}
          </div>
        </section>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-xl text-sm text-white font-medium transition-colors"
        >
          {saving
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : saved
            ? <CheckCircle className="w-4 h-4" />
            : null
          }
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
