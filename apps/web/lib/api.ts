const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  // Tasks
  getTasks: (status?: string) => apiFetch<Task[]>(`/tasks${status ? `?status=${status}` : ''}`),
  getTodayTasks: () => apiFetch<Task[]>('/tasks/today'),
  getOverdueTasks: () => apiFetch<Task[]>('/tasks/overdue'),
  createTask: (data: CreateTaskInput) => apiFetch<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<Task>) => apiFetch<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  completeTask: (id: string) => apiFetch<Task>(`/tasks/${id}/complete`, { method: 'POST' }),
  deferTask: (id: string, until?: string) => apiFetch<Task>(`/tasks/${id}/defer?defer_until=${until || ''}`, { method: 'POST' }),
  deleteTask: (id: string) => apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' }),
  markWaiting: (id: string) => apiFetch<Task>(`/tasks/${id}/mark-waiting`, { method: 'POST' }),
  delegateTask: (id: string, agentId: string) => apiFetch<Task>(`/tasks/${id}/delegate?agent_id=${agentId}`, { method: 'POST' }),

  // Agents
  getAgents: () => apiFetch<Agent[]>('/agents'),
  runAgent: (agentId: string, input: Record<string, unknown>, taskId?: string) =>
    apiFetch<AgentRun>(`/agents/${agentId}/run${taskId ? `?task_id=${taskId}` : ''}`, { method: 'POST', body: JSON.stringify(input) }),
  getAgentRuns: () => apiFetch<AgentRun[]>('/agents/runs/all'),

  // Commands
  routeCommand: (input: string, mode = 'text') =>
    apiFetch<CommandResult>('/commands/route', { method: 'POST', body: JSON.stringify({ raw_input: input, input_mode: mode }) }),
  getCommandHistory: () => apiFetch<CommandRecord[]>('/commands/history'),

  // Briefings
  getTodayBriefing: () => apiFetch<Briefing | null>('/briefings/today'),
  generateBriefing: (meetings: string[], followUps: string[]) =>
    apiFetch<Briefing>('/briefings/generate', { method: 'POST', body: JSON.stringify({ upcoming_meetings: meetings, pending_follow_ups: followUps }) }),

  // Voice
  processVoice: (transcript: string, autoExecute = false) =>
    apiFetch<CommandResult>('/voice/process', { method: 'POST', body: JSON.stringify({ transcript, auto_execute: autoExecute }) }),
  getVoiceHistory: () => apiFetch<VoiceHistoryRecord[]>('/voice/history'),

  // AI / Settings
  aiHealth: () => apiFetch<{ ollama_available: boolean; models: string[] }>('/ai/health'),
  getSettings: () => apiFetch<AppSettings>('/settings'),
  updateSettings: (data: AppSettings) => apiFetch<AppSettings>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Single task
  getTask: (id: string) => apiFetch<Task>(`/tasks/${id}`),

  // Integrations
  getIntegrations: () => apiFetch<Integration[]>('/integrations'),
  getGoogleAuthUrl: (scope = 'both') => apiFetch<{ auth_url: string; scope: string }>(`/integrations/google/auth?scope=${scope}`),
  syncIntegration: (type: string) => apiFetch<{ status: string; items_imported: number; items: unknown[] }>(`/integrations/${type}/sync`, { method: 'POST' }),
  disconnectIntegration: (type: string) => apiFetch<{ status: string }>(`/integrations/${type}/disconnect`, { method: 'POST' }),

  // End-of-Day Review
  getEodReview: () => apiFetch<EodReview>('/eod/review'),
  generateEodReview: (notes?: string) => apiFetch<EodReview>('/eod/review', { method: 'POST', body: JSON.stringify({ notes: notes || '' }) }),

  // Robots / IoT
  getRobots: () => apiFetch<Robot[]>('/robots'),
  addRobot: (data: AddRobotInput) => apiFetch<Robot>('/robots', { method: 'POST', body: JSON.stringify(data) }),
  deleteRobot: (id: string) => apiFetch<void>(`/robots/${id}`, { method: 'DELETE' }),
  getRobotStatus: (id: string) => apiFetch<{ live: RobotLiveStatus } & Robot>(`/robots/${id}/status`),
  sendRobotCommand: (id: string, command: string) => apiFetch<{ robot: Robot; result: Record<string, unknown> }>(`/robots/${id}/${command}`, { method: 'POST' }),
  scanNetwork: () => apiFetch<{ found: { ip: string; port: number; brand: string }[]; count: number }>('/robots/scan/network', { method: 'POST' }),
  getWatchBrief: () => apiFetch<WatchBrief>('/watch/brief'),

  // Stats & counts
  getOverdueCount: () => apiFetch<{ count: number }>('/tasks/overdue/count'),
  getTodayStats: () => apiFetch<TaskStats>('/tasks/stats/today'),

  // AI
  getAISuggestions: () => apiFetch<{ suggestions: AISuggestion[] }>('/ai/suggestions'),

  // Integrations — read endpoints
  getCalendarEvents: () => apiFetch<CalendarEventsResponse>('/integrations/calendar/events'),
  getGmailInbox: () => apiFetch<GmailInboxResponse>('/integrations/gmail/inbox'),

  // Voice settings
  getVoiceSettings: () => apiFetch<VoiceSettingsData>('/voice/settings'),
  updateVoiceSettings: (data: Partial<VoiceSettingsData>) => apiFetch<VoiceSettingsData>('/voice/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};

// Types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  due_date?: string;
  category: string;
  tags: string[];
  personal_or_work: string;
  next_action?: string;
  context_summary?: string;
  confidence_score?: number;
  source_reference?: string;
  agent_id?: string;
  agent_status?: string;
  source: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  due_date?: string;
  category?: string;
}

export interface Agent {
  id: string;
  name: string;
  agent_type: string;
  description: string;
  risk_level: string;
  requires_approval_for: string[];
}

export interface AgentRun {
  id: string;
  agent_id: string;
  task_id?: string;
  status: string;
  input_data: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  error_message?: string;
  created_at: string;
}

export interface AppSettings {
  [key: string]: unknown;
  ollama_base_url?: string;
  ollama_model?: string;
  wake_phrase?: string;
  voice_enabled?: boolean;
  tts_enabled?: boolean;
  user_name?: string;
  theme?: string;
  approval_policy?: string;
  cloud_provider_enabled?: boolean;
  cloud_provider?: string;
  cloud_api_key?: string;
  cloud_model?: string;
  data_sharing_acknowledged?: boolean;
  setup_complete?: boolean;
  setup_completed_at?: string | null;
}

export interface CommandResult {
  intent: string;
  confidence: number;
  target_agent?: string;
  requires_confirmation: boolean;
  confirmation_message?: string;
  user_visible_summary: string;
  command_id?: string;
  parameters?: Record<string, unknown>;
}

export interface CommandRecord {
  id: string;
  raw_input: string;
  interpreted_intent?: string;
  status: string;
  created_at: string;
}

export interface Briefing {
  id: string;
  date: string;
  summary: string;
  top_priorities: string[];
  meetings_to_prepare: string[];
  urgent_followups: string[];
  tasks_to_delegate: string[];
  risks: string[];
  recommended_schedule: string[];
  focus_score: number;
}

export interface VoiceHistoryRecord {
  id: string;
  text: string;
  routing_result: string | Record<string, unknown>;
  created_at: string;
}

export interface Integration {
  id: string;
  integration_type: string;
  name: string;
  status: string;
  last_sync_at: string | null;
}

export interface Robot {
  id: string;
  device_type: 'irobot' | 'roborock';
  name: string;
  ip_address: string | null;
  status: string;
  last_state: Record<string, unknown>;
  last_seen_at: string | null;
  configured: boolean;
}

export interface AddRobotInput {
  device_type: 'irobot' | 'roborock';
  name: string;
  ip_address: string;
  token?: string;
  blid?: string;
  password?: string;
}

export interface RobotLiveStatus {
  state?: string;
  battery?: number;
  error?: string;
  clean_time_seconds?: number;
  clean_area_m2?: number;
  bin_full?: boolean;
  fan_speed?: string;
  timestamp?: string;
}

export interface WatchBrief {
  spoken_summary: string;
  urgent_count: number;
  today_count: number;
  robots: { name: string; status: string }[];
}

export interface EodReview {
  date: string;
  completed_count: number;
  completed_tasks: { title: string; priority: string }[];
  deferred_count: number;
  deferred_tasks: { title: string; priority: string }[];
  missed_count: number;
  missed_tasks: { title: string; priority: string; status: string }[];
  tomorrow_queue: { title: string; priority: string }[];
  delegation_opportunities: string[];
  follow_ups_needed: string[];
  summary: string;
  momentum_score: number;
  recommended_actions: string[];
}

export interface TaskStats {
  completed_today: number;
  active_today: number;
  total_active: number;
  waiting_count: number;
  overdue_count: number;
  emails_cleared: number;
  total_emails: number;
  follow_ups_done: number;
  total_follow_ups: number;
}

export interface AISuggestion {
  text: string;
  action: string;
  type: 'warning' | 'tip' | 'info';
  priority: 'high' | 'medium' | 'low';
}

export interface CalendarEvent {
  id: string;
  title: string;
  due_date: string;
  description: string;
  category: string;
}

export interface CalendarEventsResponse {
  connected: boolean;
  today: CalendarEvent[];
  upcoming: { date: string; events: CalendarEvent[] }[];
}

export interface GmailInboxItem {
  id: string;
  from: string;
  subject: string;
  preview: string;
  received_at: string;
  status: string;
  priority: string;
}

export interface GmailInboxResponse {
  connected: boolean;
  items: GmailInboxItem[];
  count: number;
}

export interface VoiceSettingsData {
  wake_phrase: string;
  push_to_talk_enabled: boolean;
  wake_word_enabled: boolean;
  tts_enabled: boolean;
  stt_provider: string;
}
