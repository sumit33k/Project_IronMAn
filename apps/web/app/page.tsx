"use client";
import { FormEvent, useEffect, useState } from "react";

const API = "http://localhost:8000";

type Email = { id: string; subject: string; from: string; date: string; snippet: string; source_link: string };

export default function HomePage() {
  const [token, setToken] = useState("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [extract, setExtract] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);

  const loadTasks = async () => setTasks(await fetch(`${API}/tasks`).then((r) => r.json()));
  useEffect(() => { void loadTasks(); }, []);

  const connect = async () => {
    await fetch(`${API}/gmail/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token }) });
    alert("Gmail connected");
  };
  const disconnect = async () => { await fetch(`${API}/gmail/disconnect`, { method: "POST" }); setEmails([]); };
  const fetchEmails = async () => setEmails(await fetch(`${API}/gmail/recent`).then((r) => r.json()));
  const runExtract = async (email: Email) => { setSelected(email); setExtract(await fetch(`${API}/gmail/extract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email_text: `${email.subject}\n${email.snippet}` }) }).then((r) => r.json())); };
  const runDraft = async (email: Email) => setDraft(await fetch(`${API}/gmail/draft-reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email_text: `${email.subject}\n${email.snippet}`, goal: "Acknowledge and propose next steps" }) }).then((r) => r.json()));

  const createTask = async (title: string) => {
    if (!selected) return;
    await fetch(`${API}/tasks/from-email-action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description: `From email: ${selected.subject}`, source_link: selected.source_link }) });
    await loadTasks();
  };

  return <main className="mx-auto max-w-6xl p-8 text-slate-100">
    <h1 className="text-3xl font-semibold mb-4">Gmail + Task Extraction</h1>
    <section className="border border-slate-700 rounded p-4 grid gap-2">
      <p className="text-sm">OAuth start URL: <code>{`${API}/gmail/oauth/start`}</code></p>
      <input className="rounded bg-slate-900 p-2" placeholder="Paste Gmail access token (dev)" value={token} onChange={(e)=>setToken(e.target.value)} />
      <div className="flex gap-2"><button className="bg-blue-600 rounded px-3 py-1" onClick={connect}>Connect Gmail</button><button className="bg-slate-700 rounded px-3 py-1" onClick={fetchEmails}>Read Recent Emails</button><button className="bg-red-700 rounded px-3 py-1" onClick={disconnect}>Disconnect</button></div>
      <p className="text-xs text-amber-300">Security: drafts only, never auto-send; approval required before external actions.</p>
    </section>

    <section className="mt-6 grid gap-3">
      {emails.map((e)=><article key={e.id} className="border border-slate-700 rounded p-3"><h3 className="font-medium">{e.subject}</h3><p className="text-xs text-slate-400">{e.from} · {e.date}</p><p className="text-sm">{e.snippet}</p><a className="text-xs text-blue-300" href={e.source_link} target="_blank">Open source email</a><div className="mt-2 flex gap-2"><button className="bg-indigo-600 rounded px-2 py-1 text-xs" onClick={()=>runExtract(e)}>Extract Action Items</button><button className="bg-emerald-600 rounded px-2 py-1 text-xs" onClick={()=>runDraft(e)}>Generate Draft Reply</button></div></article>)}
    </section>

    {extract ? <section className="mt-6 border border-slate-700 rounded p-4"><h2 className="font-semibold">AI Extraction</h2>{Object.entries(extract).map(([k,v]: any)=><div key={k}><p className="text-sm font-medium">{k}</p><ul className="list-disc pl-5">{(v||[]).map((x:string)=><li key={x}>{x} <button className="ml-2 text-xs bg-blue-700 rounded px-1" onClick={()=>createTask(x)}>Create Task</button></li>)}</ul></div>)}</section>:null}

    {draft ? <section className="mt-6 border border-slate-700 rounded p-4"><h2 className="font-semibold">Draft Reply (Approval Required)</h2><pre className="text-sm whitespace-pre-wrap">{JSON.stringify(draft,null,2)}</pre></section>:null}

    <section className="mt-6 border border-slate-700 rounded p-4"><h2 className="font-semibold">Tasks</h2><ul className="list-disc pl-5">{tasks.map((t)=><li key={t.id}>{t.title} - <a className="text-blue-300" href={t.source} target="_blank">source</a></li>)}</ul></section>
  </main>;
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Mic, User, Calendar, ChevronDown, Plus } from 'lucide-react';
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
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.0 }}>
                <TodayPriorities />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}>
                <TodaySchedule />
              </motion.div>
            </div>

            {/* Row 2: AI Daily Brief + Agent Workbench */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.16 }} className="xl:col-span-2">
                <AgentWorkbench />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.24 }}>
                <DailyBrief />
              </motion.div>
            </div>

            {/* Row 3: Inbox + Follow-ups */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.32 }}>
                <InboxCaptures />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.40 }}>
                <FollowUps />
              </motion.div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="hidden 2xl:flex flex-col w-72 flex-shrink-0 gap-4">
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.15 }}>
              <AISuggestions />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.25 }}>
              <UpcomingAgenda />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.35 }}>
              <DailyProgress />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
