export type Priority = "low" | "medium" | "high";

export interface Reminder {
  id: string;
  title: string;
  dueAt?: string;
  completed: boolean;
}

export interface Routine {
  id: string;
  name: string;
  schedule: string;
  active: boolean;
}

export interface DelegatedJob {
  id: string;
  goal: string;
  status: "queued" | "running" | "done" | "failed";
  priority: Priority;
}
