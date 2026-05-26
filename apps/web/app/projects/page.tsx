'use client';

import { useEffect, useState } from 'react';
import { FolderOpen, Loader2, Plus, Trash2, X, ChevronDown, ChevronUp, CheckSquare, Archive } from 'lucide-react';
import { api, Project, Task } from '@/lib/api';
import { clsx } from 'clsx';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#eab308'];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [projectTasks, setProjectTasks] = useState<Record<string, Task[]>>({});
  const [loadingTasks, setLoadingTasks] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [form, setForm] = useState({ title: '', description: '', color: COLORS[0], due_date: '' });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      setProjects(await api.getProjects());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const project = await api.createProject({
        title: form.title.trim(),
        description: form.description.trim(),
        color: form.color,
        due_date: form.due_date || undefined,
      });
      setProjects(ps => [...ps, project]);
      setForm({ title: '', description: '', color: COLORS[0], due_date: '' });
      setShowForm(false);
    } catch { /* ignore */ } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.deleteProject(id);
      setProjects(ps => ps.filter(p => p.id !== id));
      if (expanded === id) setExpanded(null);
    } finally {
      setDeleting(null);
    }
  };

  const handleArchive = async (id: string) => {
    setArchiving(id);
    try {
      const updated = await api.updateProject(id, { status: 'archived' });
      setProjects(ps => ps.map(p => p.id === id ? updated : p));
    } finally {
      setArchiving(null);
    }
  };

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!projectTasks[id]) {
      setLoadingTasks(id);
      try {
        setProjectTasks(t => ({ ...t, [id]: [] }));
        const tasks = await api.getProjectTasks(id);
        setProjectTasks(t => ({ ...t, [id]: tasks }));
      } finally {
        setLoadingTasks(null);
      }
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  const activeProjects = projects.filter(p => p.status !== 'archived');
  const archivedProjects = projects.filter(p => p.status === 'archived');

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading projects…
    </div>
  );

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <FolderOpen className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-xs text-slate-500">{projects.length} projects · {activeProjects.length} active</p>
        </div>
        <button
          onClick={() => setShowForm(x => !x)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors font-medium"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={(e) => void handleCreate(e)} className="bg-[#131720] border border-indigo-800/40 rounded-2xl p-5 mb-5 space-y-3">
          <p className="text-sm font-semibold text-white">New Project</p>

          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Project name…"
            required
            autoFocus
            className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-600"
          />

          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={2}
            className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full placeholder-slate-600 resize-none"
          />

          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Color</label>
              <div className="flex gap-1.5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={clsx(
                      'w-6 h-6 rounded-full transition-all',
                      form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d0f14] scale-110' : 'opacity-60 hover:opacity-100'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="bg-[#1a2035] border border-[#1e2847] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating || !form.title.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Project
          </button>
        </form>
      )}

      {/* Projects list */}
      {activeProjects.length === 0 ? (
        <div className="bg-[#131720] border border-[#1e2847] rounded-2xl p-12 text-center">
          <FolderOpen className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No active projects yet.</p>
          <p className="text-slate-600 text-xs mt-1">Organize your tasks into projects with timelines.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeProjects.map(project => {
            const isExpanded = expanded === project.id;
            const tasks = projectTasks[project.id] ?? [];
            return (
              <div key={project.id} className="bg-[#131720] border border-[#1e2847] rounded-2xl overflow-hidden hover:border-indigo-800/40 transition-all">
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    {/* Color dot */}
                    <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: project.color || '#6366f1' }} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-white truncate">{project.title}</h3>
                        <span className={clsx(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium capitalize flex-shrink-0',
                          project.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                          project.status === 'archived' ? 'bg-slate-500/15 text-slate-400' :
                          'bg-indigo-500/15 text-indigo-400'
                        )}>
                          {project.status}
                        </span>
                      </div>

                      {project.description && (
                        <p className="text-xs text-slate-500 mb-2 line-clamp-1">{project.description}</p>
                      )}

                      {/* Progress bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-[#1a2035] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${project.progress || 0}%`, backgroundColor: project.color || '#6366f1' }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">
                          {project.completed_count}/{project.task_count} tasks
                        </span>
                      </div>

                      {project.due_date && (
                        <p className="text-[10px] text-slate-600 mt-1">Due {formatDate(project.due_date)}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => void toggleExpand(project.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => void handleArchive(project.id)}
                        disabled={archiving === project.id}
                        title="Archive"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        {archiving === project.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => void handleDelete(project.id)}
                        disabled={deleting === project.id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        {deleting === project.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded tasks */}
                {isExpanded && (
                  <div className="border-t border-[#1e2847] px-5 py-3">
                    {loadingTasks === project.id ? (
                      <div className="flex items-center justify-center py-4 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading tasks…
                      </div>
                    ) : tasks.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-xs text-slate-600">No tasks linked to this project.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {tasks.map(task => (
                          <div key={task.id} className="flex items-center gap-2 py-1.5">
                            <CheckSquare className={clsx(
                              'w-3.5 h-3.5 flex-shrink-0',
                              task.status === 'done' ? 'text-emerald-500' : 'text-slate-600'
                            )} />
                            <span className={clsx(
                              'text-xs truncate',
                              task.status === 'done' ? 'text-slate-600 line-through' : 'text-slate-300'
                            )}>
                              {task.title}
                            </span>
                            <span className={clsx(
                              'text-[10px] ml-auto flex-shrink-0 capitalize',
                              task.priority === 'high' || task.priority === 'critical' ? 'text-orange-500' : 'text-slate-600'
                            )}>
                              {task.priority}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Archived projects */}
      {archivedProjects.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived(s => !s)}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3"
          >
            {showArchived ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <Archive className="w-3.5 h-3.5" />
            {archivedProjects.length} archived project{archivedProjects.length !== 1 ? 's' : ''}
          </button>
          {showArchived && (
            <div className="space-y-3 opacity-60">
              {archivedProjects.map(project => (
                <div key={project.id} className="bg-[#131720] border border-[#1e2847] rounded-2xl p-5 flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || '#6366f1' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-400 truncate">{project.title}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Archived · {project.completed_count}/{project.task_count} tasks completed</p>
                  </div>
                  <button
                    onClick={() => void handleDelete(project.id)}
                    disabled={deleting === project.id}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 transition-colors"
                  >
                    {deleting === project.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
