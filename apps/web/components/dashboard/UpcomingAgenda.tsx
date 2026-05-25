'use client';

const AGENDA = [
  {
    day: 'Tomorrow – Sat, May 24',
    events: [
      { time: '10:00 AM', title: 'Team Sync',          badge: 'Google Meet', badgeBg: 'bg-blue-700' },
      { time: '11:30 AM', title: 'Client Call – Globex', badge: 'Zoom',       badgeBg: 'bg-blue-600' },
      { time: '2:00 PM',  title: 'Focus Time',          badge: 'Focus',      badgeBg: 'bg-emerald-700' },
    ],
  },
  {
    day: 'Sun, May 25',
    events: [],
  },
];

export default function UpcomingAgenda() {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
          Upcoming Agenda
        </h2>
        <button className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">
          View Calendar
        </button>
      </div>

      {AGENDA.map(({ day, events }) => (
        <div key={day} className="mb-3 last:mb-0">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{day}</p>
          {events.length === 0 ? (
            <p className="text-[10px] text-slate-600 italic pl-2">
              No events · Great day for planning! 🌟
            </p>
          ) : (
            <div className="space-y-1.5">
              {events.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-16 flex-shrink-0 font-mono">
                    {e.time}
                  </span>
                  <span className="text-xs text-slate-300 flex-1 truncate">{e.title}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded text-white flex-shrink-0 ${e.badgeBg}`}
                  >
                    {e.badge}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
