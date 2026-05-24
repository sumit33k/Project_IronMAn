'use client';

import { useState } from 'react';
import { Mail, MessageSquare, FileText } from 'lucide-react';

const ITEMS = [
  {
    type: 'email',
    from: 'Acme Corp Proposal Feedback',
    preview: 'Hi Sumit, please find attached the latest feedback on the proposal…',
    time: '8:45 AM',
    tag: 'ACTION ITEM',
    tagBg: 'bg-indigo-600',
  },
  {
    type: 'whatsapp',
    from: 'Raj Sharma',
    preview: 'Hey Sumit, can we connect around the contract update?',
    time: '7:30 AM',
    tag: 'FOLLOW UP',
    tagBg: 'bg-amber-600',
  },
  {
    type: 'doc',
    from: 'Q2 Roadmap.pptx',
    preview: 'You edited this file',
    time: 'Yesterday',
    tag: 'DOCUMENT',
    tagBg: 'bg-slate-600',
  },
  {
    type: 'slack',
    from: '#product-team',
    preview: '3 new messages',
    time: 'Yesterday',
    tag: 'MESSAGE',
    tagBg: 'bg-purple-600',
  },
];

const TABS = ['All', 'Emails 3', 'Messages 4', 'Documents 2', 'Notes 1', 'Screenshots 2'];

const ICON_MAP: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageSquare,
  doc: FileText,
  slack: MessageSquare,
};

export default function InboxCaptures() {
  const [tab, setTab] = useState('All');

  return (
    <div className="glass-card p-4">
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
        Inbox &amp; Captures
      </h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-[10px] px-2.5 py-1 rounded-md whitespace-nowrap transition-colors flex-shrink-0 ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white bg-[#1a2035] border border-[#1e2847]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {ITEMS.map((item, i) => {
          const Icon = ICON_MAP[item.type] ?? Mail;
          return (
            <div
              key={i}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#1a2035] flex items-center justify-center flex-shrink-0 border border-[#1e2847]">
                <Icon className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{item.from}</p>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{item.preview}</p>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <span className="text-[10px] text-slate-500">{item.time}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold text-white ${item.tagBg}`}>
                  {item.tag}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
