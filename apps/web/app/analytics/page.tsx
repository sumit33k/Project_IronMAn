'use client';

import { useEffect, useState } from 'react';
import { BarChart2, Loader2, TrendingUp, CheckCircle2, Target, Zap } from 'lucide-react';
import { api, AnalyticsSummary } from '@/lib/api';
import { clsx } from 'clsx';

const PERIOD_OPTIONS = [7, 14, 30, 90] as const;

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <div className="w-full h-20 flex items-end">
        <div
          className="w-full rounded-t-sm transition-all duration-500"
          style={{ height: `${pct}%`, backgroundColor: color, minHeight: value > 0 ? 4 : 0 }}
        />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<typeof PERIOD_OPTIONS[number]>(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setData(await api.getAnalytics(period));
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    void load();
  }, [period]);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <p>No analytics data available.</p>
    </div>
  );

  const maxTrend = Math.max(...(data.completion_trend?.map(d => d.completed) ?? [1]), 1);
  const maxPriority = Math.max(...(data.priority_breakdown?.map(d => d.count) ?? [1]), 1);
  const PRIORITY_COLORS: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#10b981',
  };
  const STATUS_COLORS: Record<string, string> = {
    done: '#10b981', in_progress: '#6366f1', today: '#3b82f6', waiting: '#8b5cf6', deferred: '#6b7280', todo: '#374151',
  };

  const completionRate = Math.round(data.completion_rate * 100);

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart2 className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-xs text-slate-500">Last {data.period_days} days</p>
        </div>
        {/* Period selector */}
        <div className="ml-auto flex items-center gap-1 bg-[#131720] border border-[#1e2847] rounded-xl p-1">
          {PERIOD_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                period === d ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          label="Completed"
          value={data.completed_tasks}
          sub="tasks"
          color="emerald"
        />
        <StatCard
          icon={<Target className="w-4 h-4 text-indigo-400" />}
          label="Completion Rate"
          value={`${completionRate}%`}
          sub={`of ${data.total_tasks} total`}
          color="indigo"
        />
        <StatCard
          icon={<Zap className="w-4 h-4 text-yellow-400" />}
          label="Active Tasks"
          value={data.active_tasks}
          sub="in progress"
          color="yellow"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
          label="Voice Commands"
          value={data.command_usage?.voice ?? 0}
          sub={`${data.command_usage?.total ?? 0} total`}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Completion trend */}
        {data.completion_trend && data.completion_trend.length > 0 && (
          <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-4">Daily Completions</p>
            <div className="flex items-end gap-0.5 h-24">
              {data.completion_trend.map((point, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-t-sm bg-indigo-600/70 hover:bg-indigo-500 transition-all duration-200 cursor-default"
                    style={{ height: `${maxTrend > 0 ? (point.completed / maxTrend) * 96 : 0}px`, minHeight: point.completed > 0 ? 4 : 0 }}
                    title={`${point.date}: ${point.completed}`}
                  />
                  <div className="absolute bottom-full mb-1 bg-[#1a2035] border border-[#1e2847] text-[10px] text-white px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {point.completed}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-slate-600">
                {data.completion_trend[0] ? new Date(data.completion_trend[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
              </span>
              <span className="text-[10px] text-slate-600">
                {data.completion_trend[data.completion_trend.length - 1]
                  ? new Date(data.completion_trend[data.completion_trend.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : ''}
              </span>
            </div>
          </div>
        )}

        {/* Priority breakdown */}
        {data.priority_breakdown && data.priority_breakdown.length > 0 && (
          <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-4">By Priority</p>
            <div className="space-y-2.5">
              {data.priority_breakdown.map(item => (
                <div key={item.priority} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 capitalize w-16 flex-shrink-0">{item.priority}</span>
                  <div className="flex-1 h-2 bg-[#1a2035] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((item.count / maxPriority) * 100)}%`,
                        backgroundColor: PRIORITY_COLORS[item.priority] ?? '#6366f1',
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-6 text-right flex-shrink-0">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status breakdown */}
        {data.status_breakdown && data.status_breakdown.length > 0 && (
          <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-4">By Status</p>
            <div className="space-y-2">
              {data.status_breakdown.map(item => {
                const total = data.status_breakdown.reduce((s, i) => s + i.count, 0);
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div key={item.status} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 capitalize w-20 flex-shrink-0">{item.status.replace('_', ' ')}</span>
                    <div className="flex-1 h-2 bg-[#1a2035] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[item.status] ?? '#6366f1' }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-6 text-right flex-shrink-0">{item.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Category breakdown */}
        {data.category_breakdown && data.category_breakdown.length > 0 && (
          <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5">
            <p className="text-sm font-semibold text-white mb-4">By Category</p>
            <div className="space-y-2">
              {data.category_breakdown.slice(0, 8).map((item, i) => {
                const maxCat = Math.max(...data.category_breakdown.map(d => d.count), 1);
                return (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 capitalize w-24 flex-shrink-0 truncate">{item.category || 'other'}</span>
                    <div className="flex-1 h-2 bg-[#1a2035] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 bg-indigo-600"
                        style={{ width: `${Math.round((item.count / maxCat) * 100)}%`, opacity: 1 - i * 0.08 }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-6 text-right flex-shrink-0">{item.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Top agents */}
      {data.top_agents && data.top_agents.length > 0 && (
        <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5 mt-5">
          <p className="text-sm font-semibold text-white mb-4">Top Agents</p>
          <div className="flex flex-wrap gap-2">
            {data.top_agents.map(agent => (
              <div key={agent.agent_id} className="flex items-center gap-2 bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs text-slate-300 capitalize">{agent.agent_id.replace(/_/g, ' ')}</span>
                <span className="text-[10px] text-slate-500">{agent.runs} runs</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub: string; color: string
}) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-900/40',
    indigo: 'bg-indigo-500/10 border-indigo-900/40',
    yellow: 'bg-yellow-500/10 border-yellow-900/40',
    purple: 'bg-purple-500/10 border-purple-900/40',
  };
  return (
    <div className={clsx('rounded-2xl border p-4', colorMap[color] ?? colorMap.indigo)}>
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-xs text-slate-400">{label}</p></div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}
