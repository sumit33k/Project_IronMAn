'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useStore } from '@/stores/useStore';

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-600',
  high:     'bg-orange-600',
  medium:   'bg-indigo-600',
  low:      'bg-slate-600',
};

function formatTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < 24) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function InboxCaptures() {
  const { inboxData } = useStore();
  const [tab, setTab] = useState('All');

  const connected = inboxData?.connected ?? false;
  const items = inboxData?.items ?? [];

  const filtered = tab === 'All' ? items : items.filter((it) => it.status === tab.toLowerCase());

  const tabs = ['All', `Unread ${items.filter(i => i.status === 'inbox').length}`.trim()];

  return (
    <div className="glass-card p-4">
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
        Inbox &amp; Captures
      </h2>

      {!connected ? (
        <div className="text-center py-4">
          <p className="text-xs text-slate-500 mb-2">Gmail not connected</p>
          <a
            href="/integrations"
            className="text-[10px] text-indigo-400 hover:text-indigo-300 underline transition-colors"
          >
            Connect Gmail →
          </a>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-3 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t.split(' ')[0])}
                className={`text-[10px] px-2.5 py-1 rounded-md whitespace-nowrap transition-colors flex-shrink-0 ${
                  tab === t.split(' ')[0]
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white bg-[#1a2035] border border-[#1e2847]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-4">
              Inbox is empty — nice work!
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#1a2035] flex items-center justify-center flex-shrink-0 border border-[#1e2847]">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{item.subject}</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{item.from}</p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className="text-[10px] text-slate-500">{formatTime(item.received_at)}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold text-white ${PRIORITY_BADGE[item.priority ?? 'medium'] ?? 'bg-indigo-600'}`}>
                      {(item.priority ?? 'medium').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
