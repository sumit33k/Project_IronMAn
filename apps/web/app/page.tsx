export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Project IronMAn</h1>
      <p className="text-slate-300">
        A local-first AI Personal Command Center scaffold is up and running.
      </p>
      <ul className="list-disc space-y-2 pl-6 text-slate-300">
        <li>Next.js frontend initialized</li>
        <li>FastAPI backend initialized</li>
        <li>Postgres, Redis, Qdrant, Ollama compose services ready</li>
      </ul>
    </main>
  );
}
