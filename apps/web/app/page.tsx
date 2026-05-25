'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Mic, User, Calendar, ChevronDown, Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';
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

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay },
});

export default function DashboardPage() {
  const router = useRouter();
  const [setupChecked, setSetupChecked] = useState(false);
  const { loadTasks, loadAgents, loadBriefing, checkAI, setJarvisOpen } = useStore();

  useEffect(() => {
    api.getSettings()
      .then((s) => { if (!s.setup_complete) router.push('/setup'); else setSetupChecked(true); })
      .catch(() => setSetupChecked(true));
  }, [router]);

  useEffect(() => {
    if (!setupChecked) return;
    void Promise.allSettled([loadTasks(), loadAgents(), loadBriefing(), checkAI()]);
  }, [setupChecked, loadTasks, loadAgents, loadBriefing, checkAI]);

  if (!setupChecked) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-[#1e2847] bg-[#0d0f14] sticky top-0 z-30">
        {/* Greeting */}
        <div className="flex-shrink-0 min-w-0">
          <h1 className="text-[15px] font-bold text-white leading-tight">{greeting}, Sumit! 👋</h1>
          <p className="text-[10px] text-slate-500 leading-tight">Here&apos;s your plan for today.</p>
        </div>

        {/* Command search — center */}
        <div className="flex-1 flex justify-center px-2">
          <CommandBar />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Date chip */}
          <button className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#131720] border border-[#1e2847] text-xs text-slate-300 hover:border-indigo-600/50 transition-colors">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden 2xl:inline">{dateStr}</span>
            <span className="2xl:hidden">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <ChevronDown className="w-3 h-3 text-slate-600" />
          </button>

          {/* Quick Capture CTA */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-900/40">
            <Plus className="w-3.5 h-3.5" />
            Quick Capture
          </button>

          {/* Search */}
          <button className="w-8 h-8 rounded-lg bg-[#131720] border border-[#1e2847] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <Search className="w-4 h-4" />
          </button>

          {/* Mic — opens Jarvis overlay */}
          <button
            onClick={() => setJarvisOpen(true)}
            className="w-8 h-8 rounded-lg bg-[#131720] border border-[#1e2847] flex items-center justify-center text-slate-400 hover:text-indigo-400 hover:border-indigo-600/60 transition-colors"
            title="Ask Jarvis (voice)"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Bell */}
          <button className="relative w-8 h-8 rounded-lg bg-[#131720] border border-[#1e2847] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold leading-none">3</span>
          </button>

          {/* Profile */}
          <button className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-lg bg-[#131720] border border-[#1e2847] hover:border-indigo-600/50 transition-colors">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-white leading-tight">Sumit</p>
              <p className="text-[10px] text-emerald-400 leading-tight flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Focus Mode
              </p>
            </div>
          </button>
        </div>
      </header>

      {/* ── Stats Bar ── */}
      <div className="px-5 py-2 border-b border-[#1e2847] bg-[#0a0c10]">
        <StatsBar />
      </div>

      {/* ── Main grid ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 3-column layout: main | brief+schedule | sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] 2xl:grid-cols-[1fr_320px_280px] gap-4 min-h-full">

          {/* ── Col 1: main ── */}
          <div className="space-y-4 min-w-0">
            {/* Priorities + Schedule */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div {...fade(0)}>
                <TodayPriorities />
              </motion.div>
              <motion.div {...fade(0.06)}>
                <TodaySchedule />
              </motion.div>
            </div>

            {/* Agent Workbench */}
            <motion.div {...fade(0.12)}>
              <AgentWorkbench />
            </motion.div>

            {/* Inbox + Follow-ups */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div {...fade(0.18)}>
                <InboxCaptures />
              </motion.div>
              <motion.div {...fade(0.22)}>
                <FollowUps />
              </motion.div>
            </div>
          </div>

          {/* ── Col 2: brief + agenda (xl) ── */}
          <div className="space-y-4">
            <motion.div {...fade(0.08)}>
              <DailyBrief />
            </motion.div>
            <motion.div {...fade(0.14)} className="2xl:hidden">
              <UpcomingAgenda />
            </motion.div>
            <motion.div {...fade(0.20)} className="2xl:hidden">
              <DailyProgress />
            </motion.div>
          </div>

          {/* ── Col 3: right sidebar (2xl only) ── */}
          <div className="hidden 2xl:flex flex-col gap-4">
            <motion.div {...fade(0.10)}>
              <AISuggestions />
            </motion.div>
            <motion.div {...fade(0.18)}>
              <UpcomingAgenda />
            </motion.div>
            <motion.div {...fade(0.26)}>
              <DailyProgress />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
