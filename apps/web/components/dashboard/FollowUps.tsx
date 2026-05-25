'use client';

import { useStore } from '@/stores/useStore';
import { Clock } from 'lucide-react';

const PLACEHOLDER = [
  { title: 'Waiting for Raj on contract approval', overdue: true,  label: '1 day overdue' },
  { title: 'Follow up with Acme Corp',             overdue: false, label: 'Today' },
  { title: 'Follow up with Marketing Team',        overdue: false, label: '2 days' },
  { title: 'Follow up with Design Team',           overdue: false, label: '3 days' },
  { title: 'Share deck with stakeholders',         overdue: false, label: '5 days' },
];

export default function FollowUps() {
  const { tasks } = useStore();
  const waiting = tasks.filter((t) => t.status === 'waiting');

  const items =
    waiting.length > 0
      ? waiting.slice(0, 5).map((t) => ({
          title: t.title,
          overdue: !!(t.due_date && t.due_date < new Date().toISOString().slice(0, 10)),
          label: t.due_date ?? 'No date',
        }))
      : PLACEHOLDER;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          Follow-ups
        </h2>
        <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          View All
        </button>
      </div>

      <div className="space-y-0">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 py-2 border-b border-[#1e2847] last:border-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  item.overdue ? 'bg-red-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-xs text-slate-300 truncate">{item.title}</span>
            </div>
            <span
              className={`text-[10px] flex-shrink-0 font-medium ${
                item.overdue ? 'text-red-400' : 'text-slate-500'
              }`}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
