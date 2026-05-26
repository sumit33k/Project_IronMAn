'use client';
import ComingSoon from '@/components/ui/ComingSoon';
import { FolderOpen } from 'lucide-react';

export default function Page() {
  return <ComingSoon title="Projects" description="Organize tasks and goals into projects with timelines and milestones." phase="Phase 3" Icon={FolderOpen} />;
}
