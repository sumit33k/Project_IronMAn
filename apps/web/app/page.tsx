'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Mic, User, Calendar, ChevronDown, Plus } from 'lucide-react';
import { useStore } from '@/stores/useStore';
import { api } from '@/lib/api';
import CommandBar from '@/components/command/CommandBar';
import StatsBar from '@/components/dashboard/StatsBar';
import TodayPriorities from '@/components/dashboard/TodayPriorities';
import TodaySchedule from '@/components/dashboard/TodaySchedule';
import DailyBrief from '@/components/dashboard/DailyBrief';
import AgentWorkbench from '@/components/dashboard/AgentWorkbench';
import InboxCaptures from '@/components/dashboard/InboxCaptures';
import FollowUps from '@/components/dashboard/FollowUps';
import AISuggestions from '@/components/dashboard/AISuggestions';
import UpcomingAgenda from '@/components/dashboard/UpcomingAgenda';
import DailyProgress from '@/components/dashboard/DailyProgress';

export default function DashboardPage() {
  const router = useRouter();
  const [setupChecked, setSetupChecked] = useState(false);
  const { loadTasks, loadAgents, loadBriefing, checkAI } = useStore();

  useEffect(() => {
    api.getSettings()
      .then((settings) => {
        if (!settings.setup_complete) {
          router.push('/setup');
        } else {
          setSetupChecked(true);
        }
      })
      .catch(() => {
        setSetupChecked(true);
      });
  }, [router]);

  useEffect(() => {
    if (!setupChecked) return;
    void Promise.allSettled([loadTasks(), loadAgents(), loadBriefing(), checkAI()]);
  }, [setupChecked, loadTasks, loadAgents, loadBriefing, checkAI]);

  if (!setupChecked) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-3 border-b border-[#1e2847] bg-[#0d0f14] sticky top-0 z-30">
        <div className="flex-shrink-0">
          <h1 className="text-base font-bold text-white">{greeting}, Sumit! 👋</h1>
          <p className="text-[11px] text-slate-500">Here&apos;s your plan for today.</p>
        </div>

        <div className="flex-1 flex justify-center">
          <CommandBar />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2035] border border-[#1e2847] text-xs text-slate-300 hover:border-indigo-700/60 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{today}</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          <button className="relative w-8 h-8 rounded-lg bg-[#1a2035] border border-[#1e2847] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">3</span>
          </button>

          <button className="w-8 h-8 rounded-lg bg-[#1a2035] border border-[#1e2847] flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-colors">
            <Mic className="w-4 h-4" />
          </button>

          <button className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[#1a2035] border border-[#1e2847] hover:border-indigo-700/60 transition-colors">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-white leading-none">Sumit</p>
              <p className="text-[9px] text-emerald-400 leading-none mt-0.5">● Focus Mode</p>
            </div>
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="px-6 py-2.5 border-b border-[#1e2847] bg-[#0a0c10]">
        <StatsBar />
      </div>

      {/* Quick Capture CTA */}
      <div className="px-6 pt-4 flex items-center justify-between">
        <div />
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs text-white font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Quick Capture
        </button>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 pt-3">
        <div className="flex gap-4 min-h-full">
          {/* Center — main content */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Row 1: Priorities + Schedule */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <TodayPriorities />
              <TodaySchedule />
            </div>

            {/* Row 2: AI Daily Brief + Agent Workbench */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <AgentWorkbench />
              </div>
              <DailyBrief />
            </div>

            {/* Row 3: Inbox + Follow-ups */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <InboxCaptures />
              <FollowUps />
            </div>
          </div>

          {/* Right sidebar */}
          <div className="hidden 2xl:flex flex-col w-72 flex-shrink-0 gap-4">
            <AISuggestions />
            <UpcomingAgenda />
            <DailyProgress />
          </div>
        </div>
      </div>
    </div>
  );
}
