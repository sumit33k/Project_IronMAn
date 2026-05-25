import Link from 'next/link';
import { HelpCircle, ExternalLink, Github } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-indigo-400" /> Help
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Resources and support for Jarvis Command Center</p>
      </div>

      <div className="space-y-3">
        <div className="glass-card p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Voice Commands</h2>
          <p className="text-xs text-slate-400">Go to <Link href="/voice" className="text-indigo-400 hover:underline">Voice</Link> and click the microphone. Say things like:</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-400 list-disc list-inside">
            <li>&quot;Create task: review Q2 report&quot;</li>
            <li>&quot;Show today&apos;s priorities&quot;</li>
            <li>&quot;Defer the standup prep to Friday&quot;</li>
            <li>&quot;Draft email to the design team&quot;</li>
          </ul>
        </div>

        <div className="glass-card p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Keyboard Shortcuts</h2>
          <div className="space-y-1 text-xs text-slate-400">
            <div className="flex justify-between"><span>Open command bar</span><kbd className="bg-[#1a2035] px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd></div>
            <div className="flex justify-between"><span>Ask Jarvis</span><kbd className="bg-[#1a2035] px-1.5 py-0.5 rounded text-[10px]">⌥J</kbd></div>
          </div>
        </div>

        <div className="glass-card p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Report an Issue</h2>
          <p className="text-xs text-slate-400 mb-2">Found a bug? Open a GitHub issue.</p>
          <a
            href="https://github.com/sumit33k/Project_IronMAn/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-600/20 border border-indigo-600/40 text-indigo-300 rounded-lg hover:bg-indigo-600/30 transition-colors"
          >
            <Github className="w-3.5 h-3.5" /> Open GitHub Issues <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
