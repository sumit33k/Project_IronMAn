'use client';
import ComingSoon from '@/components/ui/ComingSoon';
import { Calendar } from 'lucide-react';

export default function Page() {
  return <ComingSoon title="Calendar" description="View and manage your schedule. Google Calendar sync available via Integrations." phase="Phase 3" Icon={Calendar} />;
}
