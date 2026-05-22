"use client";
import { FormEvent, useEffect, useState } from "react";

const API = "http://localhost:8000";

type Email = { id: string; subject: string; from: string; date: string; snippet: string; source_link: string };

export default function HomePage() {
  const [token, setToken] = useState("");
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [extract, setExtract] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);

  const loadTasks = async () => setTasks(await fetch(`${API}/tasks`).then((r) => r.json()));
  useEffect(() => { void loadTasks(); }, []);

  const connect = async () => {
    await fetch(`${API}/gmail/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: token }) });
    alert("Gmail connected");
  };
  const disconnect = async () => { await fetch(`${API}/gmail/disconnect`, { method: "POST" }); setEmails([]); };
  const fetchEmails = async () => setEmails(await fetch(`${API}/gmail/recent`).then((r) => r.json()));
  const runExtract = async (email: Email) => { setSelected(email); setExtract(await fetch(`${API}/gmail/extract`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email_text: `${email.subject}\n${email.snippet}` }) }).then((r) => r.json())); };
  const runDraft = async (email: Email) => setDraft(await fetch(`${API}/gmail/draft-reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email_text: `${email.subject}\n${email.snippet}`, goal: "Acknowledge and propose next steps" }) }).then((r) => r.json()));

  const createTask = async (title: string) => {
    if (!selected) return;
    await fetch(`${API}/tasks/from-email-action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description: `From email: ${selected.subject}`, source_link: selected.source_link }) });
    await loadTasks();
  };

  return <main className="mx-auto max-w-6xl p-8 text-slate-100">
    <h1 className="text-3xl font-semibold mb-4">Gmail + Task Extraction</h1>
    <section className="border border-slate-700 rounded p-4 grid gap-2">
      <p className="text-sm">OAuth start URL: <code>{`${API}/gmail/oauth/start`}</code></p>
      <input className="rounded bg-slate-900 p-2" placeholder="Paste Gmail access token (dev)" value={token} onChange={(e)=>setToken(e.target.value)} />
      <div className="flex gap-2"><button className="bg-blue-600 rounded px-3 py-1" onClick={connect}>Connect Gmail</button><button className="bg-slate-700 rounded px-3 py-1" onClick={fetchEmails}>Read Recent Emails</button><button className="bg-red-700 rounded px-3 py-1" onClick={disconnect}>Disconnect</button></div>
      <p className="text-xs text-amber-300">Security: drafts only, never auto-send; approval required before external actions.</p>
    </section>

    <section className="mt-6 grid gap-3">
      {emails.map((e)=><article key={e.id} className="border border-slate-700 rounded p-3"><h3 className="font-medium">{e.subject}</h3><p className="text-xs text-slate-400">{e.from} · {e.date}</p><p className="text-sm">{e.snippet}</p><a className="text-xs text-blue-300" href={e.source_link} target="_blank">Open source email</a><div className="mt-2 flex gap-2"><button className="bg-indigo-600 rounded px-2 py-1 text-xs" onClick={()=>runExtract(e)}>Extract Action Items</button><button className="bg-emerald-600 rounded px-2 py-1 text-xs" onClick={()=>runDraft(e)}>Generate Draft Reply</button></div></article>)}
    </section>

    {extract ? <section className="mt-6 border border-slate-700 rounded p-4"><h2 className="font-semibold">AI Extraction</h2>{Object.entries(extract).map(([k,v]: any)=><div key={k}><p className="text-sm font-medium">{k}</p><ul className="list-disc pl-5">{(v||[]).map((x:string)=><li key={x}>{x} <button className="ml-2 text-xs bg-blue-700 rounded px-1" onClick={()=>createTask(x)}>Create Task</button></li>)}</ul></div>)}</section>:null}

    {draft ? <section className="mt-6 border border-slate-700 rounded p-4"><h2 className="font-semibold">Draft Reply (Approval Required)</h2><pre className="text-sm whitespace-pre-wrap">{JSON.stringify(draft,null,2)}</pre></section>:null}

    <section className="mt-6 border border-slate-700 rounded p-4"><h2 className="font-semibold">Tasks</h2><ul className="list-disc pl-5">{tasks.map((t)=><li key={t.id}>{t.title} - <a className="text-blue-300" href={t.source} target="_blank">source</a></li>)}</ul></section>
  </main>;
}
