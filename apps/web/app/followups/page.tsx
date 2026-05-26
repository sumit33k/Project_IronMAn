'use client';
import ComingSoon from '@/components/ui/ComingSoon';
import { RefreshCw } from 'lucide-react';

export default function Page() {
  return <ComingSoon title="Follow-ups" description="Track items you're waiting on and automated nudge reminders." phase="Phase 3" Icon={RefreshCw} />;
}
