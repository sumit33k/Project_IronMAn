'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Clock, CheckSquare, FolderOpen, Calendar, Mail,
  RefreshCw, Bot, FileText, StickyNote, RotateCcw, Target, Users,
  BarChart2, Settings, Plus, CalendarPlus, Send, FileEdit, Mic,
  Upload, Camera, Zap, Inbox, Link2, Moon, Crosshair, Kanban, HelpCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useStore } from '@/stores/useStore';
import { api, Integration } from '@/lib/api';

const NAV = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Today', href: '/today', icon: Clock },
  { label: 'Inbox', href: '/inbox', icon: Inbox },
  { label: 'Board', href: '/board', icon: Kanban },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Focus Mode', href: '/focus', icon: Crosshair },
  { label: 'Daily Review', href: '/review', icon: Moon },
  { label: 'Robots', href: '/robots', icon: Zap },
  { label: 'Agents', href: '/agents', icon: Bot },
  { label: 'Briefing', href: '/briefing', icon: FileText },
  { label: 'Projects', href: '/projects', icon: FolderOpen },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Emails', href: '/emails', icon: Mail },
  { label: 'Follow-ups', href: '/followups', icon: RefreshCw },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'Notes', href: '/notes', icon: StickyNote },
  { label: 'Routines', href: '/routines', icon: RotateCcw },
  { label: 'Goals', href: '/goals', icon: Target },
  { label: 'Contacts', href: '/contacts', icon: Users },
  { label: 'Analytics', href: '/analytics', icon: BarChart2 },
  { label: 'Integrations', href: '/integrations', icon: Link2 },
  { label: 'Voice', href: '/voice', icon: Mic },
];

const QUICK_ACTIONS = [
  { label: 'Add Task', icon: Plus, href: '/?action=new-task' },
  { label: 'Schedule Meeting', icon: CalendarPlus, href: '/?action=schedule' },
  { label: 'Send Email', icon: Send, href: '/?action=email' },
  { label: 'New Note', icon: FileEdit, href: '/?action=note' },
  { label: 'Voice Note', icon: Mic, href: '/voice' },
  { label: 'Upload Document', icon: Upload, href: '/?action=upload' },
  { label: 'Capture Screen', icon: Camera, href: '/?action=capture' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { setJarvisOpen, displayName, inboxData, tasks } = useStore();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    api.getIntegrations().then(setIntegrations).catch(() => {});
  }, []);

  const emailBadge = inboxData?.count ?? 0;
  const followUpBadge = tasks.filter((t) => t.status === 'waiting').length;

  const getBadge = (href: string): number | null => {
    if (!mounted) return null;
    if (href === '/emails') return emailBadge > 0 ? emailBadge : null;
    if (href === '/followups') return followUpBadge > 0 ? followUpBadge : null;
    return null;
  };

  const connectedIntegrations = integrations.filter((i) => i.status === 'active');

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-screen bg-[#0f1117] border-r border-[#1e2847] overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[#1e2847]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-white tracking-wider uppercase">{displayName}&apos;s</p>
            <p className="text-[10px] text-slate-400 tracking-widest uppercase">Command Center</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon }) => {
          const badge = getBadge(href);
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all',
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                {label}
              </span>
              {badge !== null && (
                <span
                  className={clsx(
                    'text-xs px-1.5 py-0.5 rounded-full font-medium',
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-900/60 text-indigo-300'
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Integrations */}
      <div className="px-4 py-3 border-t border-[#1e2847]">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Integrations</p>
        <div className="flex items-center gap-2 flex-wrap">
          {connectedIntegrations.length > 0 ? (
            connectedIntegrations.map((i) => (
              <span key={i.id} className="text-[10px] px-2 py-1 rounded bg-[#1e2847] text-slate-400">
                {i.name || i.integration_type}
              </span>
            ))
          ) : (
            <Link href="/integrations" className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors">
              Connect →
            </Link>
          )}
          <Link href="/integrations" className="text-[10px] px-2 py-1 rounded bg-[#1e2847] text-indigo-400">+</Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 border-t border-[#1e2847]">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Quick Actions</p>
        <div className="space-y-0.5">
          {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Jarvis Voice Button */}
      <div className="px-4 py-3 border-t border-[#1e2847]">
        <button
          onClick={() => setJarvisOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-600/40 text-indigo-300 hover:bg-indigo-600/30 hover:border-indigo-500/60 transition-all group"
        >
          <Mic className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold tracking-wide">Ask Jarvis</span>
          <span className="ml-auto text-[10px] text-indigo-500 border border-indigo-800 rounded px-1">⌥J</span>
        </button>
      </div>

      {/* Settings + Help */}
      <div className="p-4 border-t border-[#1e2847] flex items-center justify-between">
        <Link
          href="/settings"
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-all"
        >
          <Settings className="w-4 h-4" /> Settings
        </Link>
        <Link
          href="/help"
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition-all"
        >
          <HelpCircle className="w-3.5 h-3.5" /> Help
        </Link>
      </div>
    </aside>
  );
}
