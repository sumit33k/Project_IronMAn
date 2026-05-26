'use client';

import { useEffect, useState, useCallback } from 'react';
import { Link2, Mail, Calendar, BookOpen, MessageSquare, Loader2, AlertCircle, CheckCircle2, RefreshCw, Unplug } from 'lucide-react';
import { api, Integration } from '@/lib/api';
import { clsx } from 'clsx';

interface IntegrationConfig {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  comingSoon?: boolean;
}

const INTEGRATIONS: IntegrationConfig[] = [
  { type: 'gmail', label: 'Gmail', icon: Mail, description: 'Import unread emails as inbox tasks.' },
  { type: 'gcalendar', label: 'Google Calendar', icon: Calendar, description: 'Import today\'s and tomorrow\'s events as tasks.' },
  { type: 'notion', label: 'Notion', icon: BookOpen, description: 'Sync pages and tasks from Notion.', comingSoon: true },
  { type: 'slack', label: 'Slack', icon: MessageSquare, description: 'Import starred messages and action items.', comingSoon: true },
];

type Toast = { message: string; kind: 'success' | 'error' };

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<Record<string, 'connect' | 'sync' | 'disconnect'>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [polling, setPolling] = useState(false);

  const showToast = (message: string, kind: 'success' | 'error') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const data = await api.getIntegrations();
      setIntegrations(data);
    } catch {
      setError('Could not load integrations — is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (new URLSearchParams(window.location.search).get('status') === 'connected') {
      showToast('Google connected successfully!', 'success');
    }
  }, [load]);

  const getIntegration = (type: string) => integrations.find(i => i.integration_type === type);

  const handleConnect = async (type: string) => {
    setActing(a => ({ ...a, [type]: 'connect' }));
    try {
      const { auth_url } = await api.getGoogleAuthUrl('both');
      window.open(auth_url, '_blank');
      showToast('Complete authentication in the opened tab. Polling for connection…', 'success');
      setPolling(true);
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const data = await api.getIntegrations().catch(() => null);
        if (data) {
          setIntegrations(data);
          const connected = data.some(i => (i.integration_type === 'gmail' || i.integration_type === 'gcalendar') && i.status === 'active');
          if (connected || attempts >= 40) {
            clearInterval(poll);
            setPolling(false);
            if (connected) showToast('Google connected!', 'success');
          }
        }
      }, 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Connection failed';
      showToast(msg.includes('GOOGLE_CLIENT_ID') ? 'Set GOOGLE_CLIENT_ID in your .env file first.' : msg, 'error');
    } finally {
      setActing(a => { const n = { ...a }; delete n[type]; return n; });
    }
  };

  const handleSync = async (type: string) => {
    setActing(a => ({ ...a, [type]: 'sync' }));
    try {
      const result = await api.syncIntegration(type);
      showToast(`Synced ${result.items_imported} new item${result.items_imported !== 1 ? 's' : ''} from ${type}`, 'success');
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Sync failed', 'error');
    } finally {
      setActing(a => { const n = { ...a }; delete n[type]; return n; });
    }
  };

  const handleDisconnect = async (type: string) => {
    if (!confirm(`Disconnect ${type}? Your synced tasks will remain.`)) return;
    setActing(a => ({ ...a, [type]: 'disconnect' }));
    try {
      await api.disconnectIntegration(type);
      showToast(`${type} disconnected`, 'success');
      await load();
    } catch {
      showToast('Disconnect failed', 'error');
    } finally {
      setActing(a => { const n = { ...a }; delete n[type]; return n; });
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading integrations…
    </div>
  );

  return (
    <div className="p-6 max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className={clsx(
          'fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm shadow-2xl transition-all',
          toast.kind === 'success'
            ? 'bg-emerald-950/90 border-emerald-800/60 text-emerald-300'
            : 'bg-red-950/90 border-red-800/60 text-red-300',
        )}>
          {toast.kind === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-600/40 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-xs text-slate-500">Connect your tools to automatically import tasks.</p>
        </div>
        {polling && (
          <div className="ml-auto flex items-center gap-2 text-xs text-amber-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for auth…
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl bg-red-950/40 border border-red-900/40 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-4">
        {INTEGRATIONS.map(({ type, label, icon: Icon, description, comingSoon }) => {
          const row = getIntegration(type);
          const isActive = row?.status === 'active';
          const taskActing = acting[type];

          return (
            <div
              key={type}
              className={clsx(
                'bg-[#131720] border rounded-2xl p-5 flex items-start gap-4 transition-all',
                isActive ? 'border-emerald-900/50' : 'border-[#1e2847]',
                comingSoon && 'opacity-60',
              )}
            >
              <div className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                isActive ? 'bg-emerald-950/50 border border-emerald-900/50' : 'bg-[#1a2035] border border-[#1e2847]',
              )}>
                <Icon className={clsx('w-5 h-5', isActive ? 'text-emerald-400' : 'text-slate-500')} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-white">{label}</p>
                  {comingSoon ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e2847] text-slate-500">Coming Soon</span>
                  ) : isActive ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-900/40 text-emerald-400">Connected</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e2847] text-slate-500">Not Connected</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{description}</p>
                {isActive && row?.last_sync_at && (
                  <p className="text-[10px] text-slate-700 mt-1">
                    Last sync: {new Date(row.last_sync_at).toLocaleString()}
                  </p>
                )}
              </div>

              {!comingSoon && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isActive ? (
                    <>
                      <button
                        onClick={() => void handleSync(type)}
                        disabled={!!taskActing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2035] border border-[#1e2847] hover:border-emerald-700/50 text-xs text-slate-300 transition-all disabled:opacity-50"
                      >
                        {taskActing === 'sync' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />}
                        Sync
                      </button>
                      <button
                        onClick={() => void handleDisconnect(type)}
                        disabled={!!taskActing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2035] border border-red-900/40 hover:border-red-700/60 text-xs text-red-400 transition-all disabled:opacity-50"
                      >
                        {taskActing === 'disconnect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => void handleConnect(type)}
                      disabled={!!taskActing}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium transition-all disabled:opacity-50"
                    >
                      {taskActing === 'connect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                      Connect
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-[#131720] border border-[#1e2847] rounded-2xl p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Privacy</p>
        <p className="text-xs text-slate-600 leading-relaxed">
          All data stays local. OAuth tokens are stored in your SQLite database only. No data is sent to third-party servers
          except to the Google APIs when you explicitly trigger a sync.
        </p>
      </div>
    </div>
  );
}
