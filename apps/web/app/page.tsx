"use client";

import { FormEvent, useState } from "react";

type BriefResponse = {
  top_priorities: string[];
  risks: string[];
  suggested_schedule: string[];
  follow_ups: string[];
  recommended_deferrals: string[];
};

const parseLines = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export default function HomePage() {
  const [todaysTasks, setTodaysTasks] = useState("");
  const [overdueTasks, setOverdueTasks] = useState("");
  const [upcomingMeetings, setUpcomingMeetings] = useState("");
  const [pendingFollowUps, setPendingFollowUps] = useState("");
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/ai/daily-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          todays_tasks: parseLines(todaysTasks),
          overdue_tasks: parseLines(overdueTasks),
          upcoming_meetings: parseLines(upcomingMeetings),
          pending_follow_ups: parseLines(pendingFollowUps),
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to generate daily brief");
      }

      const data: BriefResponse = await response.json();
      setBrief(data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
      setBrief(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold">Daily Brief</h1>
      <p className="text-slate-300">Generate a local AI morning brief from your current work context.</p>

      <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border border-slate-700 p-4">
        {[
          ["Today&apos;s Tasks", todaysTasks, setTodaysTasks],
          ["Overdue Tasks", overdueTasks, setOverdueTasks],
          ["Upcoming Meetings", upcomingMeetings, setUpcomingMeetings],
          ["Pending Follow-ups", pendingFollowUps, setPendingFollowUps],
        ].map(([label, value, setValue]) => (
          <label key={label as string} className="grid gap-2 text-sm">
            <span className="font-medium">{label as string} (one per line)</span>
            <textarea
              className="min-h-24 rounded-md border border-slate-600 bg-slate-900 p-2"
              value={value as string}
              onChange={(e) => (setValue as (v: string) => void)(e.target.value)}
            />
          </label>
        ))}

        <button
          type="submit"
          className="w-fit rounded-md bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate Brief"}
        </button>
      </form>

      {error ? <div className="rounded-md border border-red-500 p-3 text-red-300">{error}</div> : null}

      {brief ? (
        <section className="grid gap-4 md:grid-cols-2">
          {Object.entries(brief).map(([section, items]) => (
            <article key={section} className="rounded-lg border border-slate-700 p-4">
              <h2 className="mb-2 text-lg font-semibold capitalize">{section.replaceAll("_", " ")}</h2>
              <ul className="list-disc space-y-1 pl-5 text-slate-300">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
