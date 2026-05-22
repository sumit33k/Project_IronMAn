"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TaskStatus = "inbox" | "today" | "in_progress" | "waiting" | "deferred" | "scheduled" | "completed" | "archived";
type TaskCategory = "office" | "personal" | "finance" | "health" | "errands" | "project";
type TaskPriority = "critical" | "high" | "medium" | "low";

type Task = {
  id: number;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  source: string | null;
  assigned_agent: string | null;
  created_at: string;
  updated_at: string;
};

const API = "http://localhost:8000";

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [today, setToday] = useState<Task[]>([]);
  const [overdue, setOverdue] = useState<Task[]>([]);
  const [form, setForm] = useState({ title: "", description: "", category: "office", priority: "medium", status: "inbox", due_date: "" });

  const load = async () => {
    const [a, b, c] = await Promise.all([
      fetch(`${API}/tasks`).then((r) => r.json()),
      fetch(`${API}/tasks/today`).then((r) => r.json()),
      fetch(`${API}/tasks/overdue`).then((r) => r.json()),
    ]);
    setTasks(a);
    setToday(b);
    setOverdue(c);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await fetch(`${API}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, due_date: form.due_date || null }),
    });
    setForm({ title: "", description: "", category: "office", priority: "medium", status: "inbox", due_date: "" });
    await load();
  };

  const updateStatus = async (id: number, status: TaskStatus) => {
    await fetch(`${API}/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    await load();
  };

  const removeTask = async (id: number) => {
    await fetch(`${API}/tasks/${id}`, { method: "DELETE" });
    await load();
  };

  const sections = useMemo(() => [{ title: "All Tasks", data: tasks }, { title: "Today Queue", data: today }, { title: "Overdue", data: overdue }], [tasks, today, overdue]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Task Engine MVP</h1>

      <form onSubmit={submit} className="grid gap-3 rounded border border-slate-700 p-4 md:grid-cols-2">
        <input className="rounded bg-slate-900 p-2" placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input className="rounded bg-slate-900 p-2" placeholder="Due date YYYY-MM-DD" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        <input className="rounded bg-slate-900 p-2 md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select className="rounded bg-slate-900 p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          { ["office","personal","finance","health","errands","project"].map((x) => <option key={x}>{x}</option>) }
        </select>
        <select className="rounded bg-slate-900 p-2" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          { ["critical","high","medium","low"].map((x) => <option key={x}>{x}</option>) }
        </select>
        <select className="rounded bg-slate-900 p-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          { ["inbox","today","in_progress","waiting","deferred","scheduled","completed","archived"].map((x) => <option key={x}>{x}</option>) }
        </select>
        <button className="rounded bg-blue-600 px-4 py-2">Create Task</button>
      </form>

      {sections.map((section) => (
        <section key={section.title} className="rounded border border-slate-700 p-4">
          <h2 className="mb-3 text-xl font-semibold">{section.title}</h2>
          <div className="grid gap-3">
            {section.data.map((task) => (
              <article key={task.id} className="rounded border border-slate-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{task.title}</h3>
                  <span className="text-xs text-slate-400">{task.status}</span>
                </div>
                <p className="text-sm text-slate-300">{task.description}</p>
                <p className="text-xs text-slate-400">{task.category} · {task.priority} · due {task.due_date ?? "n/a"}</p>
                <div className="mt-2 flex gap-2">
                  <button className="rounded bg-emerald-700 px-2 py-1 text-xs" onClick={() => updateStatus(task.id, "completed")}>Complete</button>
                  <button className="rounded bg-amber-700 px-2 py-1 text-xs" onClick={() => updateStatus(task.id, "deferred")}>Defer</button>
                  <button className="rounded bg-slate-700 px-2 py-1 text-xs" onClick={() => updateStatus(task.id, "in_progress")}>Start</button>
                  <button className="rounded bg-red-700 px-2 py-1 text-xs" onClick={() => removeTask(task.id)}>Delete</button>
                </div>
              </article>
            ))}
            {section.data.length === 0 ? <p className="text-sm text-slate-400">No tasks.</p> : null}
          </div>
        </section>
      ))}
    </main>
  );
}
