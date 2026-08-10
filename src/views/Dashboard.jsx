"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Search, ArrowRight, FileText, HelpCircle, CalendarDays, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, timeAgo } from "./_shared";

const fmtTime = (t) => (t ? t.slice(0, 5) : "—");
const parseHM = (hm) => {
  if (!hm) return null;
  const [h, m] = hm.split(":");
  return { h: Number(h), m: Number(m) };
};

// Find the lesson the teacher is most likely "in" right now: prefer one
// whose start..end window contains the current minute; otherwise the
// next future lesson today. Returns { mode: 'live' | 'next' | 'done', lesson }.
function pickNowLesson(lessons) {
  if (!lessons?.length) return { mode: "done", lesson: null };
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();
  let next = null;
  let nextDelta = Infinity;
  for (const l of lessons) {
    const a = parseHM(l.start_time);
    const b = parseHM(l.end_time);
    if (!a) continue;
    const startM = a.h * 60 + a.m;
    const endM = b ? b.h * 60 + b.m : startM + 55;
    if (nowM >= startM && nowM < endM) {
      return { mode: "live", lesson: l, startM, endM };
    }
    if (startM > nowM && startM - nowM < nextDelta) {
      next = { lesson: l, startM, endM };
      nextDelta = startM - nowM;
    }
  }
  if (next) return { mode: "next", ...next };
  return { mode: "done", lesson: null };
}

// Tick the clock so live counters stay fresh without re-fetching data.
function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
}

// The surprise: a Murchid now-playing hero. Drenched warm surface,
// holds the greeting, current/next class, a live countdown, and the
// two primary actions. Reads as a continuation of the landing.
function NowPlayingHero({ me, todayLessons, onJump }) {
  useMinuteTick();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = me?.first_name || "there";

  const status = useMemo(() => pickNowLesson(todayLessons), [todayLessons]);
  const now = new Date();
  const nowM = now.getHours() * 60 + now.getMinutes();

  let headline;
  let meta;
  let cta;
  if (status.mode === "live") {
    const l = status.lesson;
    const left = Math.max(0, status.endM - nowM);
    headline = (
      <>
        Right now, <em>{l.title || "your class"}</em> with {l.section || l.grade || "your group"}.
      </>
    );
    meta = (
      <>
        <span><span className="dash-nowcard-pulse" aria-hidden="true" />Live · {left} min left</span>
        <span>{l.subject ? <b>{l.subject}</b> : null} · {fmtTime(l.start_time)}–{fmtTime(l.end_time)}</span>
        <span>{l.location || "—"}</span>
      </>
    );
    cta = "Open class";
  } else if (status.mode === "next") {
    const l = status.lesson;
    const until = Math.max(0, status.startM - nowM);
    const inText =
      until < 60 ? `in ${until} min` : `at ${fmtTime(l.start_time)}`;
    headline = (
      <>
        Next up, <em>{l.title || "your next class"}</em> {inText}.
      </>
    );
    meta = (
      <>
        <span><b>{l.section || l.grade || "—"}</b></span>
        <span>{l.subject || "—"} · {fmtTime(l.start_time)}–{fmtTime(l.end_time)}</span>
        <span>{l.location || "—"}</span>
      </>
    );
    cta = "See today";
  } else {
    headline = (
      <>
        {greeting}, <em>{first}</em>. You're <em>clear</em> for today.
      </>
    );
    meta = (
      <>
        <span>{today}</span>
        <span>Nothing more on the schedule.</span>
      </>
    );
    cta = "Plan tomorrow";
  }

  return (
    <section className="dash-nowcard" aria-label="Now playing">
      <div className="dash-nowcard-eyebrow">{today}</div>
      <h1 className="dash-nowcard-h">{headline}</h1>
      <div className="dash-nowcard-meta">{meta}</div>
      <div>
        <button
          type="button"
          className="dash-nowcard-cta"
          onClick={() => onJump?.(status.mode === "done" ? "planner" : "schedule")}
        >
          {cta} <ArrowRight size={15} />
        </button>
        <button
          type="button"
          className="dash-nowcard-ghost"
          onClick={() => onJump?.("planner")}
        >
          Open planner
        </button>
      </div>
    </section>
  );
}

// The library tiles and the quick actions. Data, not markup, so the two
// grids stay one line each and adding a kind is one entry.
const LIBRARY = [
  { key: "drafts",        label: "Lesson plans",  section: "lesson-plans" },
  { key: "quizzes",       label: "Quizzes",       section: "quizzes" },
  { key: "homework",      label: "Homework",      section: "homework" },
  { key: "presentations", label: "Presentations", section: "presentations" },
];

const QUICK = [
  { icon: FileText,     title: "Draft a lesson plan", hint: "Describe it; edit what comes back", section: "lesson-plans" },
  { icon: HelpCircle,   title: "Build a quiz",        hint: "Multiple choice, short answer, essay", section: "quizzes" },
  { icon: CalendarDays, title: "Plan your week",      hint: "Put lessons on the timetable",       section: "schedule" },
  { icon: Users,        title: "Add your students",   hint: "Register, attendance and marks",     section: "database" },
];

// Section header chrome — used by every sub-card so the dashboard reads
// as one composition rather than five independent cards.
//
// Defined OUT here on purpose. Inside the component it was a new
// component type on every render, so React threw away each card's
// subtree and rebuilt it — which is why typing in the drafts filter lost
// focus after the first keystroke.
function SectionHead({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-serif text-xl md:text-2xl font-medium text-ink">{title}</h2>
      {action && (
        <Button variant="ghost" size="sm" onClick={onAction}>
          {action} <ArrowRight size={13} />
        </Button>
      )}
    </div>
  );
}

/** Grey bars while the first load is in flight. */
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded bg-line/50 ${className}`} aria-hidden="true" />;
}

export default function Dashboard({ onJump }) {
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    api("/api/me").then((r) => live && setMe(r)).catch(() => {});
    api("/api/dashboard")
      .then((r) => live && setData(r))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  const counts = data?.counts || {};
  const todayLessons = data?.today_lessons || [];
  const upcomingLessons = data?.upcoming_lessons || [];
  const recentDrafts = data?.recent_drafts || [];
  const plan = data?.plan || null;
  const isNew = !loading && !error && (data?.counts?.total ?? 0) === 0 && todayLessons.length === 0;
  const q = query.trim().toLowerCase();
  const filteredDrafts = q
    ? recentDrafts.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.subject || "").toLowerCase().includes(q) ||
          (d.status || "").toLowerCase().includes(q)
      )
    : recentDrafts;

  // "Ahead" used to count homework and quizzes that were out with a
  // class. That comes from assignments, which has no screen yet, so it
  // was structurally always zero — a tile reporting nothing is worse
  // than no tile. Runway replaced it: how long is left on the plan is
  // something a teacher should read here rather than discover when a
  // save is refused.
  const kpis = [
    { label: "Today",    value: todayLessons.length,  em: "lessons",   caption: "scheduled today" },
    { label: "Your work", value: counts.total ?? 0,   em: "items",     caption: "plans, quizzes and more" },
    { label: "Students", value: counts.students ?? 0, em: "in roster", caption: "across every class" },
    plan?.days_left != null
      ? { label: plan.status === "trialing" ? "Trial" : "Plan",
          value: plan.days_left, em: plan.days_left === 1 ? "day left" : "days left",
          caption: plan.status === "trialing" ? "then choose a plan" : `${plan.plan} · ${plan.status}` }
      : { label: "Drafts", value: counts.drafts ?? 0, em: "plans", caption: "lesson plans in progress" },
  ];


  return (
    <div className="space-y-6">
      <NowPlayingHero me={me} todayLessons={todayLessons} onJump={onJump} />

      {plan && plan.days_left != null && plan.days_left <= 3 && (
        <div className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-ink flex-1 min-w-[200px]">
            {plan.days_left === 0
              ? <>Your {plan.status === "trialing" ? "trial" : "plan"} has ended. You can still open and export everything you have made.</>
              : <>Your {plan.status === "trialing" ? "trial" : "plan"} ends in <b>{plan.days_left} {plan.days_left === 1 ? "day" : "days"}</b>.</>}
          </p>
          <Button size="sm" onClick={() => onJump?.("account")}>Choose a plan</Button>
        </div>
      )}

      {error && (
        <div className="bg-paper border border-accent/30 rounded-xl p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-accent mb-1">
            Could not load dashboard
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      {/* Filter bar — sits above the recent drafts table. Hidden until
          there's anything to filter so it doesn't add noise on a fresh
          account. */}
      {/* Skeletons rather than zeros. Rendering the real tiles before the
          data arrives showed "0 lessons, 0 items, 0 students" for a beat
          — which on a slow connection is a teacher reading that they
          have nothing, then watching it correct itself. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className="dash-kpi">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-20 mt-2" />
                <Skeleton className="h-3 w-24 mt-2" />
              </div>
            ))
          : kpis.map((k) => (
              <div key={k.label} className="dash-kpi">
                <p className="dash-kpi-label">{k.label}</p>
                <p className="dash-kpi-value">
                  {k.value}<em className="text-[0.4em] font-serif italic ml-1 text-muted not-italic"> {k.em}</em>
                </p>
                <p className="dash-kpi-cap">{k.caption}</p>
              </div>
            ))}
      </div>

      {/* A teacher on day one had five cards each saying "nothing yet",
          which reads as a broken product rather than an empty one. One
          card that tells them what to do first is the whole difference. */}
      {isNew && (
        <Card elevation="flat">
          <CardContent className="p-5 md:p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-accent mb-1.5">
              First steps
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-ink leading-tight">
              Nothing here yet — <em className="italic text-accent">that is the right place to start.</em>
            </h2>
            <p className="text-sm text-ink-soft mt-2 max-w-xl">
              Draft one lesson and the rest of this page fills itself in: the schedule,
              your library, and what your students are doing.
            </p>
            <div className="grid sm:grid-cols-2 gap-2.5 mt-4">
              {QUICK.map((a) => (
                <button
                  key={a.section}
                  type="button"
                  onClick={() => onJump?.(a.section)}
                  className="text-start rounded-xl border border-line bg-paper-cool hover:border-accent hover:bg-paper transition-colors px-4 py-3 flex items-center gap-3"
                >
                  <a.icon size={17} className="text-accent flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{a.title}</span>
                    <span className="block text-xs text-muted mt-0.5">{a.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card elevation="flat">
          <CardContent className="p-5 md:p-6">
            <SectionHead
              title="Today's schedule"
              action="View calendar"
              onAction={() => onJump?.("schedule")}
            />
            {todayLessons.length === 0 ? (
              <p className="text-sm text-muted py-4">Nothing scheduled today.</p>
            ) : (
              <div>
                {todayLessons.map((s, i) => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-4 py-3 ${
                      i < todayLessons.length - 1 ? "border-b border-dashed border-line" : ""
                    }`}
                  >
                    <span className="text-[11px] font-medium tracking-wider text-muted w-14 mt-1 flex-shrink-0">
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
                    <span className="text-[10px] uppercase tracking-wider font-medium px-2.5 py-1 rounded-full border bg-paper-cool text-ink-soft border-line whitespace-nowrap flex-shrink-0">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card elevation="flat">
          <CardContent className="p-5 md:p-6">
            <SectionHead
              title="Upcoming this week"
              action="Full week"
              onAction={() => onJump?.("schedule")}
            />
            {upcomingLessons.length === 0 ? (
              <p className="text-sm text-muted py-4">Nothing scheduled in the next 7 days.</p>
            ) : (
              <div>
                {upcomingLessons.map((s, i) => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-4 py-2.5 text-sm ${
                      i < upcomingLessons.length - 1 ? "border-b border-dashed border-line" : ""
                    }`}
                  >
                    <span className="text-[10px] uppercase tracking-wider font-medium text-muted w-20 flex-shrink-0 mt-0.5">
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

      {/* What the two dead cards became.
          "Homework due soon" and "Quizzes this fortnight" both read from
          assignments — giving a piece of work to a class — which has no
          screen yet, so both were permanently empty. Two cards saying
          "nothing" is worse than one card that is true. This is what a
          teacher can actually act on: what they have made, by kind, with
          a way in. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card elevation="flat">
          <CardContent className="p-5 md:p-6">
            <SectionHead
              title="Your library"
              action="Lesson plans"
              onAction={() => onJump?.("lesson-plans")}
            />
            <div className="grid grid-cols-2 gap-2.5">
              {LIBRARY.map((k) => (
                <button
                  key={k.section}
                  type="button"
                  onClick={() => onJump?.(k.section)}
                  className="text-start rounded-xl border border-line bg-paper-cool hover:border-accent hover:bg-paper transition-colors px-3.5 py-3"
                >
                  <p className="font-serif text-2xl text-ink leading-none">{counts[k.key] ?? 0}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted mt-1.5">{k.label}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card elevation="flat">
          <CardContent className="p-5 md:p-6">
            <SectionHead title="Start something" />
            <div className="space-y-2">
              {QUICK.map((a) => (
                <button
                  key={a.section}
                  type="button"
                  onClick={() => onJump?.(a.section)}
                  className="w-full text-start rounded-xl border border-line bg-paper-cool hover:border-accent hover:bg-paper transition-colors px-4 py-3 flex items-center gap-3"
                >
                  <a.icon size={17} className="text-accent flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm text-ink">{a.title}</span>
                    <span className="block text-xs text-muted mt-0.5">{a.hint}</span>
                  </span>
                  <ArrowRight size={14} className="text-muted ms-auto flex-shrink-0 rtl:rotate-180" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>


      <Card elevation="flat">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-serif text-xl md:text-2xl font-medium text-ink">Recent lesson drafts</h2>
            <div className="flex items-center gap-2">
              <div className="bg-paper-cool border border-line rounded-full px-3.5 py-1.5 flex items-center gap-2 w-44 sm:w-56">
                <Search size={14} className="text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter drafts…"
                  className="bg-transparent outline-none text-sm w-full text-ink placeholder:text-muted"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => onJump?.("lesson-plans")}>
                All drafts <ArrowRight size={13} />
              </Button>
            </div>
          </div>
          {filteredDrafts.length === 0 ? (
            <p className="text-sm text-muted py-4">
              {recentDrafts.length === 0
                ? "No drafts yet — start one in Lesson Plans."
                : "No drafts match your filter."}
            </p>
          ) : (
            <div>
              {filteredDrafts.map((d, i) => (
                <div
                  key={d.id}
                  className={`flex items-center justify-between gap-4 py-3 text-sm ${
                    i < filteredDrafts.length - 1 ? "border-b border-dashed border-line" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-ink truncate">{d.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {d.subject} · {d.status} · {d.progress}%
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-medium text-muted whitespace-nowrap">
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
