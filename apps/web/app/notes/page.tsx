'use client';
import ComingSoon from '@/components/ui/ComingSoon';
import { StickyNote } from 'lucide-react';

export default function Page() {
  return <ComingSoon title="Notes" description="Quick capture and AI-organized notes linked to tasks." phase="Phase 3" Icon={StickyNote} />;
}
