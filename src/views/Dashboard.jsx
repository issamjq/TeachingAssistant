import React, { useEffect, useState } from "react";
import { Search, ClipboardList, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { api, timeAgo } from "./_shared";

const fmtTime = (t) => (t ? t.slice(0, 5) : "—");

export default function Dashboard({ onJump }) {
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api("/api/me").then(setMe).catch(() => {});
    api("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  const counts = data?.counts || {};
  const todayLessons = data?.today_lessons || [];
  const upcomingLessons = data?.upcoming_lessons || [];
  const pendingHomework = data?.pending_homework || [];
  const pendingQuizzes = data?.pending_quizzes || [];
  const recentDrafts = data?.recent_drafts || [];
  const q = query.trim().toLowerCase();
  const filteredDrafts = q
    ? recentDrafts.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.subject || "").toLowerCase().includes(q) ||
          (d.status || "").toLowerCase().includes(q)
      )
    : recentDrafts;

  const kpis = [
    { label: "Today",    value: todayLessons.length, caption: "scheduled lessons" },
    { label: "Pending",  value: (pendingHomework.length || 0) + (pendingQuizzes.length || 0), caption: "homework & quizzes ahead" },
    { label: "Drafts",   value: counts.drafts ?? 0,  caption: "lesson plans in flight" },
    { label: "Students", value: counts.students ?? 0, caption: "in your roster" },
  ];

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-5xl font-medium text-ink leading-tight">
            {greeting}, <em className="italic text-accent">{me?.first_name || "there"}</em>.
          </h1>
          <p className="text-muted mt-2">
            {today} · {todayLessons.length} {todayLessons.length === 1 ? "class" : "classes"} today
          </p>
        </div>
        <div className="bg-paper-cool border border-line rounded-full px-4 py-2.5 flex items-center gap-2 w-full md:w-72">
          <Search size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter recent drafts…"
            className="bg-transparent outline-none text-sm w-full text-ink placeholder:text-muted"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">
            Could not load dashboard
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
                {k.label}
              </p>
              <p className="font-serif text-5xl font-medium text-accent leading-none mb-3">
                {k.value}
              </p>
              <p className="text-sm text-ink-soft">{k.caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl font-medium text-ink">Today&rsquo;s schedule</h2>
              <button
                onClick={() => onJump?.("schedule")}
                className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
              >
                View calendar →
              </button>
            </div>
            {todayLessons.length === 0 ? (
              <p className="text-sm text-muted py-4">Nothing scheduled today.</p>
            ) : (
              <div className="space-y-0">
                {todayLessons.map((s, i) => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-4 py-4 ${
                      i < todayLessons.length - 1 ? "border-b border-dashed border-line" : ""
                    }`}
                  >
                    <span className="font-mono text-[11px] text-muted w-12 mt-1 flex-shrink-0">
                      {fmtTime(s.start_time)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-lg text-ink leading-tight">
                        {s.title} · {s.section || s.grade || ""}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {s.subject ? `${s.subject} · ` : ""}{s.location || "—"} · {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded-full border bg-paper-cool text-ink border-line whitespace-nowrap flex-shrink-0">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl font-medium text-ink">Upcoming this week</h2>
              <button
                onClick={() => onJump?.("schedule")}
                className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
              >
                Full week →
              </button>
            </div>
            {upcomingLessons.length === 0 ? (
              <p className="text-sm text-muted py-4">Nothing scheduled in the next 7 days.</p>
            ) : (
              <div className="space-y-0">
                {upcomingLessons.map((s, i) => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-4 py-3 text-sm ${
                      i < upcomingLessons.length - 1 ? "border-b border-dashed border-line" : ""
                    }`}
                  >
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted w-20 flex-shrink-0 mt-0.5">
                      {new Date(s.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-ink truncate">{s.title}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {fmtTime(s.start_time)} · {s.subject || "—"} · {s.section || s.grade || "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl font-medium text-ink inline-flex items-center gap-2">
                <ClipboardList size={20} className="text-accent" /> Homework due soon
              </h2>
              <button
                onClick={() => onJump?.("homework")}
                className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
              >
                Manage →
              </button>
            </div>
            {pendingHomework.length === 0 ? (
              <p className="text-sm text-muted py-4">No homework due in the next 7 days.</p>
            ) : (
              <ul className="space-y-0">
                {pendingHomework.map((h, i) => (
                  <li
                    key={h.id}
                    className={`flex items-start justify-between gap-3 py-3 text-sm ${
                      i < pendingHomework.length - 1 ? "border-b border-dashed border-line" : ""
                    }`}
                  >
                    <div>
                      <p className="text-ink">{h.title}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {h.subject || "—"} · {h.grade || ""}{h.section ? ` · ${h.section}` : ""}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted whitespace-nowrap mt-0.5">
                      {h.due_date ? new Date(h.due_date).toLocaleDateString() : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl font-medium text-ink inline-flex items-center gap-2">
                <GraduationCap size={20} className="text-accent" /> Quizzes ahead
              </h2>
              <button
                onClick={() => onJump?.("quizzes")}
                className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
              >
                Manage →
              </button>
            </div>
            {pendingQuizzes.length === 0 ? (
              <p className="text-sm text-muted py-4">No quizzes scheduled in the next 14 days.</p>
            ) : (
              <ul className="space-y-0">
                {pendingQuizzes.map((q, i) => (
                  <li
                    key={q.id}
                    className={`flex items-start justify-between gap-3 py-3 text-sm ${
                      i < pendingQuizzes.length - 1 ? "border-b border-dashed border-line" : ""
                    }`}
                  >
                    <div>
                      <p className="text-ink">{q.title}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {q.subject || "—"} · {q.grade || ""}{q.section ? ` · ${q.section}` : ""} · {q.total_marks ?? "—"} marks
                      </p>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted whitespace-nowrap mt-0.5">
                      {q.scheduled_for ? new Date(q.scheduled_for).toLocaleDateString() : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-2xl font-medium text-ink">Recent lesson drafts</h2>
            <button
              onClick={() => onJump?.("lesson-plans")}
              className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
            >
              All drafts →
            </button>
          </div>
          {filteredDrafts.length === 0 ? (
            <p className="text-sm text-muted py-4">
              {recentDrafts.length === 0
                ? "No drafts yet — start one in Lesson Plans."
                : "No drafts match your filter."}
            </p>
          ) : (
            <div className="space-y-0">
              {filteredDrafts.map((d, i) => (
                <div
                  key={d.id}
                  className={`flex items-center justify-between gap-4 py-3 text-sm ${
                    i < filteredDrafts.length - 1 ? "border-b border-dashed border-line" : ""
                  }`}
                >
                  <div>
                    <p className="text-ink">{d.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {d.subject} · {d.status} · {d.progress}%
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted whitespace-nowrap">
                    {timeAgo(d.last_edited)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
