import Link from 'next/link';
import { LucideIcon, ArrowLeft } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  phase?: string;
  Icon?: LucideIcon;
}

export default function ComingSoon({ title, description, phase = 'Phase 3', Icon }: Props) {
  return (
    <div className="p-6 max-w-xl">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </Link>

      <div className="glass-card p-8 text-center">
        {Icon && (
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center mx-auto mb-4">
            <Icon className="w-7 h-7 text-indigo-400" />
          </div>
        )}
        <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
        <p className="text-sm text-slate-400 mb-4">{description}</p>
        <span className="inline-block text-xs px-3 py-1 rounded-full bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 font-medium">
          Coming in {phase}
        </span>
      </div>
    </div>
  );
}
