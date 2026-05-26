'use client';
import { useStore } from '@/stores/useStore';
import { Flag, Calendar, CheckSquare, RefreshCw, Clock } from 'lucide-react';

export default function StatsBar() {
  const { todayTasks, tasks, overdueTasks, calendarEvents } = useStore();
  const priorities = todayTasks.filter(
    (t) => t.priority === 'high' || t.priority === 'critical'
  ).length;
  const waiting = tasks.filter((t) => t.status === 'waiting').length;
  const meetings = calendarEvents?.today?.length ?? 0;

  const stats = [
    {
      label: 'Priorities',
      value: priorities,
      icon: Flag,
      color: 'text-red-400',
      bg: 'bg-red-950/40',
    },
    {
      label: 'Meetings',
      value: meetings,
      icon: Calendar,
      color: 'text-blue-400',
      bg: 'bg-blue-950/40',
    },
    {
      label: 'Tasks',
      value: tasks.length,
      icon: CheckSquare,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40',
    },
    {
      label: 'Follow-ups',
      value: waiting,
      icon: RefreshCw,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40',
    },
    {
      label: 'Overdue',
      value: overdueTasks.length,
      icon: Clock,
      color: 'text-purple-400',
      bg: 'bg-purple-950/40',
    },
  ];

  return (
    <div className="flex items-center gap-4">
      {stats.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-lg font-bold text-white">{value}</span>
          <span className="text-xs text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  );
}
