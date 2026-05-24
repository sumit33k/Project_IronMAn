'use client';

const EVENTS = [
  { time: '9:00 AM',  title: 'Review Infoblox proposal',    span: '9:00 – 10:00 AM',   type: 'task' },
  { time: '11:00 AM', title: 'Client Meeting – Acme Corp',  span: '11:00 AM – 12:00 PM', type: 'meet', badge: 'Google Meet' },
  { time: '12:00 PM', title: 'Lunch Break',                 span: '12:00 – 1:00 PM',   type: 'break' },
  { time: '1:00 PM',  title: 'Project Plan Review',         span: '1:00 – 2:00 PM',    type: 'meet', badge: 'Zoom' },
  { time: '2:00 PM',  title: 'Focus Time (Deep Work)',      span: '2:00 – 4:00 PM',    type: 'focus', badge: 'Focus' },
  { time: '4:00 PM',  title: 'Email & Follow-ups',          span: '4:00 – 5:00 PM',    type: 'task' },
];

const DOT: Record<string, string> = {
  task: 'bg-indigo-500', meet: 'bg-blue-500', break: 'bg-slate-500', focus: 'bg-emerald-500',
};

const BADGE: Record<string, string> = {
  'Google Meet': 'bg-blue-700', 'Zoom': 'bg-blue-600', 'Focus': 'bg-emerald-700',
};

export default function TodaySchedule() {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
          Today&apos;s Schedule
        </h2>
        <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          View Calendar
        </button>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[60px] top-2 bottom-2 w-px bg-[#1e2847]" />

        <div className="space-y-0">
          {EVENTS.map((ev, i) => (
            <div key={i} className="flex items-start gap-3 py-2 group">
              <span className="text-[10px] text-slate-500 w-[52px] text-right flex-shrink-0 pt-1 font-mono">
                {ev.time}
              </span>
              <div
                className={`w-2 h-2 rounded-full ${DOT[ev.type]} flex-shrink-0 mt-1.5 relative z-10 ring-2 ring-[#0d0f14]`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 group-hover:text-white transition-colors leading-tight">
                  {ev.title}
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5">{ev.span}</p>
              </div>
              {ev.badge && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium text-white flex-shrink-0 ${BADGE[ev.badge] ?? 'bg-slate-600'}`}>
                  {ev.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
