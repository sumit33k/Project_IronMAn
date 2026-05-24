'use client';
import { useStore } from '@/stores/useStore';
import { Flag, Calendar, CheckSquare, RefreshCw, Clock } from 'lucide-react';

export default function StatsBar() {
  const { todayTasks, tasks, overdueTasks } = useStore();
  const priorities = todayTasks.filter(
    (t) => t.priority === 'high' || t.priority === 'urgent'
  ).length;
  const waiting = tasks.filter((t) => t.status === 'waiting').length;

  const stats = [
    {
      label: 'Priorities',
      value: priorities || 6,
      icon: Flag,
      color: 'text-red-400',
      bg: 'bg-red-950/40',
    },
    {
      label: 'Meetings',
      value: 3,
      icon: Calendar,
      color: 'text-blue-400',
      bg: 'bg-blue-950/40',
    },
    {
      label: 'Tasks',
      value: tasks.length || 12,
      icon: CheckSquare,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40',
    },
    {
      label: 'Follow-ups',
      value: waiting || 7,
      icon: RefreshCw,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40',
    },
    {
      label: 'Awaiting Review',
      value: 2,
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
