'use client';

import { useEffect, useState } from 'react';
import { Calendar, Loader2, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { api, CalendarEvent } from '@/lib/api';
import { clsx } from 'clsx';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface UpcomingGroup { date: string; events: CalendarEvent[] }

export default function CalendarPage() {
  const [connected, setConnected] = useState(false);
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getCalendarEvents();
        setConnected(data.connected);
        setTodayEvents(data.today);
        setUpcoming(data.upcoming);
      } catch {
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // Build calendar grid
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  // Build event lookup by date
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  todayEvents.forEach(e => {
    const d = e.due_date.split('T')[0];
    if (!eventsByDate[d]) eventsByDate[d] = [];
    eventsByDate[d].push(e);
  });
  upcoming.forEach(({ date, events }) => {
    const d = date.split('T')[0];
    if (!eventsByDate[d]) eventsByDate[d] = [];
    eventsByDate[d].push(...events);
  });

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];
  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading calendar…
    </div>
  );

  if (!connected) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
      <Calendar className="w-12 h-12 text-slate-700" />
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white mb-1">Google Calendar not connected</h2>
        <p className="text-sm text-slate-500 mb-4">Connect your Google account to sync your calendar.</p>
        <a
          href="/integrations"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium"
        >
          Connect Calendar →
        </a>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-xs text-slate-500">{todayEvents.length} events today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar grid */}
        <div className="lg:col-span-2 bg-[#131720] border border-[#1e2847] rounded-2xl p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-semibold text-white">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] text-slate-600 py-1 font-medium">{d}</div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasEvents = !!eventsByDate[dateStr]?.length;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(s => s === dateStr ? null : dateStr)}
                  className={clsx(
                    'relative h-9 w-full rounded-lg flex flex-col items-center justify-center transition-all text-xs',
                    isSelected ? 'bg-indigo-600 text-white' :
                      isToday ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-800/60' :
                        'text-slate-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  {day}
                  {hasEvents && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Events panel */}
        <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5">
          <p className="text-sm font-semibold text-white mb-4">
            {selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : "Today's Events"}
          </p>

          <div className="space-y-2">
            {(selectedDate ? selectedEvents : todayEvents).length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-600">No events</p>
              </div>
            ) : (
              (selectedDate ? selectedEvents : todayEvents).map(event => (
                <div key={event.id} className="bg-[#1a2035] border border-[#1e2847] rounded-xl p-3">
                  <p className="text-sm font-medium text-white leading-tight">{event.title}</p>
                  {event.due_date && (
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span className="text-[10px] text-slate-500">{formatTime(event.due_date)}</span>
                    </div>
                  )}
                  {event.description && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{event.description}</p>
                  )}
                  {event.category && (
                    <span className="text-[10px] text-indigo-400 mt-1 capitalize">{event.category}</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Upcoming */}
          {!selectedDate && upcoming.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Upcoming</p>
              <div className="space-y-3">
                {upcoming.slice(0, 4).map(({ date, events }) => (
                  <div key={date}>
                    <p className="text-[10px] text-slate-600 mb-1">
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    {events.slice(0, 2).map(e => (
                      <div key={e.id} className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-2 py-1.5 mb-1">
                        <p className="text-xs text-slate-300 truncate">{e.title}</p>
                      </div>
                    ))}
                    {events.length > 2 && (
                      <p className="text-[10px] text-slate-600 px-1">+{events.length - 2} more</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
