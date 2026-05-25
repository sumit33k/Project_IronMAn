'use client';

import { useStore } from '@/stores/useStore';

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return isoDate;
  }
}

function formatTime(isoOrDate: string): string {
  if (!isoOrDate) return '';
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function UpcomingAgenda() {
  const { calendarEvents } = useStore();

  const connected = calendarEvents?.connected ?? false;
  const upcoming = calendarEvents?.upcoming ?? [];

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
          Upcoming Agenda
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
      ) : upcoming.length === 0 ? (
        <p className="text-[10px] text-slate-600 italic pl-2">No upcoming events this week.</p>
      ) : (
        upcoming.map(({ date, events }) => (
          <div key={date} className="mb-3 last:mb-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
              {formatDate(date)}
            </p>
            {events.length === 0 ? (
              <p className="text-[10px] text-slate-600 italic pl-2">No events</p>
            ) : (
              <div className="space-y-1.5">
                {events.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-16 flex-shrink-0 font-mono">
                      {formatTime(e.due_date ?? date)}
                    </span>
                    <span className="text-xs text-slate-300 flex-1 truncate">{e.title}</span>
                    {e.category && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded text-white flex-shrink-0 bg-blue-700 capitalize">
                        {e.category}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
