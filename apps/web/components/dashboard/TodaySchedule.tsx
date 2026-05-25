'use client';

import { useStore } from '@/stores/useStore';

const DOT_COLOR: Record<string, string> = {
  meeting: 'bg-blue-500',
  task:    'bg-indigo-500',
  focus:   'bg-emerald-500',
  break:   'bg-slate-500',
};

function formatTime(isoOrDate: string): string {
  if (!isoOrDate) return '';
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return isoOrDate;
  }
}

export default function TodaySchedule() {
  const { calendarEvents } = useStore();

  const connected = calendarEvents?.connected ?? false;
  const events = calendarEvents?.today ?? [];

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
          Today&apos;s Schedule
        </h2>
        {connected && (
          <span className="text-[10px] text-emerald-400">Connected</span>
        )}
      </div>

      {!connected ? (
        <div className="text-center py-4">
          <p className="text-xs text-slate-500 mb-2">Google Calendar not connected</p>
          <a
            href="/integrations"
            className="text-[10px] text-indigo-400 hover:text-indigo-300 underline transition-colors"
          >
            Connect Google Calendar →
          </a>
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-4">
          No events today — enjoy the free time!
        </p>
      ) : (
        <div className="relative">
          <div className="absolute left-[60px] top-2 bottom-2 w-px bg-[#1e2847]" />
          <div className="space-y-0">
            {events.map((ev, i) => {
              const dot = DOT_COLOR[ev.category ?? 'meeting'] ?? 'bg-blue-500';
              const timeStr = formatTime(ev.due_date ?? '');
              return (
                <div key={ev.id ?? i} className="flex items-start gap-3 py-2 group">
                  <span className="text-[10px] text-slate-500 w-[52px] text-right flex-shrink-0 pt-1 font-mono">
                    {timeStr}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${dot} flex-shrink-0 mt-1.5 relative z-10 ring-2 ring-[#0d0f14]`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors leading-tight">
                      {ev.title}
                    </p>
                    {ev.description && (
                      <p className="text-[10px] text-slate-600 mt-0.5 truncate">{ev.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
