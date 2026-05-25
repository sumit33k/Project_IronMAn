import { create } from 'zustand';
import { Task, Agent, Briefing, CommandResult, api } from '@/lib/api';

interface JarvisStore {
  tasks: Task[];
  todayTasks: Task[];
  overdueTasks: Task[];
  agents: Agent[];
  briefing: Briefing | null;
  ollamaAvailable: boolean;
  commandResult: CommandResult | null;
  isCommandPending: boolean;
  sidebarCollapsed: boolean;
  jarvisOpen: boolean;

  loadTasks: () => Promise<void>;
  loadAgents: () => Promise<void>;
  loadBriefing: () => Promise<void>;
  checkAI: () => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  deferTask: (id: string, until?: string) => Promise<void>;
  createTask: (data: { title: string; priority?: string; category?: string }) => Promise<void>;
  routeCommand: (input: string) => Promise<CommandResult>;
  setSidebarCollapsed: (v: boolean) => void;
  setJarvisOpen: (v: boolean) => void;
}

export const useStore = create<JarvisStore>((set, get) => ({
  tasks: [],
  todayTasks: [],
  overdueTasks: [],
  agents: [],
  briefing: null,
  ollamaAvailable: false,
  commandResult: null,
  isCommandPending: false,
  sidebarCollapsed: false,
  jarvisOpen: false,

  loadTasks: async () => {
    const [tasks, todayTasks, overdueTasks] = await Promise.all([
      api.getTasks(),
      api.getTodayTasks(),
      api.getOverdueTasks(),
    ]);
    set({ tasks, todayTasks, overdueTasks });
  },

  loadAgents: async () => {
    const agents = await api.getAgents();
    set({ agents });
  },

  loadBriefing: async () => {
    const briefing = await api.getTodayBriefing();
    set({ briefing });
  },

  checkAI: async () => {
    try {
      const h = await api.aiHealth();
      set({ ollamaAvailable: h.ollama_available });
    } catch {
      set({ ollamaAvailable: false });
    }
  },

  completeTask: async (id) => {
    await api.completeTask(id);
    await get().loadTasks();
  },

  deferTask: async (id, until) => {
    await api.deferTask(id, until);
    await get().loadTasks();
  },

  createTask: async (data) => {
    await api.createTask(data);
    await get().loadTasks();
  },

  routeCommand: async (input) => {
    set({ isCommandPending: true });
    try {
      const result = await api.routeCommand(input);
      set({ commandResult: result });
      return result;
    } finally {
      set({ isCommandPending: false });
    }
  },

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setJarvisOpen: (v) => set({ jarvisOpen: v }),
}));
