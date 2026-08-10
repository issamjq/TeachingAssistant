"use client";

// =====================================================================
// The teacher's dashboard
//
// Three questions, in the order a teacher asks them on a Monday:
//   what is happening today?      the hero and the calendar
//   what needs me?                the task list
//   how is it going?              the trend and the breakdown
//
// Glass surfaces, per the design brief — but at 86% opacity with a real
// border, because glass over cream at 10% is invisible and puts text
// below 4.5:1. See Dashboard.module.css for the full argument.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Sparkles, CalendarDays, FileText, HelpCircle, Users } from "lucide-react";
import { api } from "@/views/_shared";
import { MiniCalendar, TrendChart, TypeBreakdown, TaskList } from "./widgets";
import s from "./Dashboard.module.css";

const fmtTime = (t) => (t ? t.slice(0, 5) : "—");
const hm = (t) => { if (!t) return null; const [h, m] = t.split(":"); return Number(h) * 60 + Number(m); };

const QUICK = [
  { icon: Sparkles,     title: "Open AI Studio",    hint: "Describe it; edit what comes back", section: "studio" },
  { icon: FileText,     title: "Draft a lesson",    hint: "Objectives, activity, assessment",  section: "lesson-plans" },
  { icon: HelpCircle,   title: "Build a quiz",      hint: "MCQ, short answer, essay",          section: "quizzes" },
  { icon: Users,        title: "Add students",      hint: "Register, attendance, marks",       section: "database" },
];

/** The lesson a teacher is most likely in right now, or the next one. */
function nowLesson(lessons) {
  if (!lessons?.length) return { mode: "clear" };
  const now = new Date();
  const m = now.getHours() * 60 + now.getMinutes();
  let next = null, delta = Infinity;
  for (const l of lessons) {
    const a = hm(l.start_time);
    if (a == null) continue;
    const b = hm(l.end_time) ?? a + 55;
    if (m >= a && m < b) return { mode: "live", lesson: l, left: b - m };
    if (a > m && a - m < delta) { next = l; delta = a - m; }
  }
  return next ? { mode: "next", lesson: next, until: delta } : { mode: "clear" };
}

function Panel({ children, className = "", raised = false, accent = false }) {
  const skin = accent ? s.glassAccent : raised ? s.glassRaised : s.glass;
  return <section className={`${skin} ${className}`}>{children}</section>;
}

function Head({ eyebrow, title, action, onAction }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        {eyebrow && <p className={`${s.eyebrow} mb-1`}>{eyebrow}</p>}
        <h2 className={s.title}>{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="text-[12px] text-muted hover:text-accent transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap mt-0.5"
        >
          {action} <ArrowRight size={12} className="rtl:rotate-180" />
        </button>
      )}
    </div>
  );
}

const Bar = ({ w = "w-24", h = "h-4" }) => (
  <div className={`animate-pulse rounded bg-line/50 ${w} ${h}`} aria-hidden="true" />
);

export default function DashboardView({ onJump }) {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
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

  const today = data?.today_lessons || [];
  const counts = data?.counts || {};
  const plan = data?.plan || null;
  const status = useMemo(() => nowLesson(today), [today]);
  const isNew = !loading && !error && (counts.total ?? 0) === 0 && today.length === 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  let headline, sub;
  if (status.mode === "live") {
    headline = <>Right now — <em>{status.lesson.title || "your class"}</em></>;
    sub = `${status.left} min left · ${status.lesson.section || status.lesson.grade || "your group"}`;
  } else if (status.mode === "next") {
    headline = <>Next up — <em>{status.lesson.title || "your next class"}</em></>;
    sub = status.until < 60
      ? `in ${status.until} min · ${fmtTime(status.lesson.start_time)}`
      : `at ${fmtTime(status.lesson.start_time)}`;
  } else {
    headline = <>{greeting}, <em>{me?.first_name || "there"}</em></>;
    sub = today.length ? "Nothing more on the schedule today." : "Nothing scheduled today.";
  }

  return (
    <div className="space-y-4">
      {/* ── hero ─────────────────────────────────────────────────── */}
      <Panel accent className="p-5 md:p-7">
        <p className={s.eyebrow}>{dateLine}</p>
        <h1 className="font-serif text-[26px] md:text-[34px] leading-[1.1] font-medium text-ink mt-2">
          {headline}
        </h1>
        <p className="text-sm text-ink-soft mt-1.5">{sub}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => onJump?.("studio")}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <Sparkles size={15} /> Open AI Studio
          </button>
          <button
            type="button"
            onClick={() => onJump?.("planner")}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-full border border-line bg-surface/70 text-ink text-sm hover:border-accent transition-colors cursor-pointer"
          >
            <CalendarDays size={15} /> Planner
          </button>
        </div>
      </Panel>

      {plan?.days_left != null && plan.days_left <= 3 && (
        <Panel className="px-4 py-3 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-ink flex-1 min-w-[220px]">
            {plan.days_left === 0
              ? <>Your {plan.status === "trialing" ? "trial" : "plan"} has ended. Everything you have made stays readable.</>
              : <>Your {plan.status === "trialing" ? "trial" : "plan"} ends in <b>{plan.days_left} {plan.days_left === 1 ? "day" : "days"}</b>.</>}
          </p>
          <button
            type="button"
            onClick={() => onJump?.("account")}
            className="h-9 px-4 rounded-full bg-accent text-on-accent text-[13px] font-medium hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Choose a plan
          </button>
        </Panel>
      )}

      {error && (
        <Panel className="p-4">
          <p className={s.eyebrow}>Could not load the dashboard</p>
          <p className="text-sm text-ink-soft mt-1">{error}</p>
        </Panel>
      )}

      {isNew && (
        <Panel raised className="p-5 md:p-6">
          <p className={s.eyebrow}>First steps</p>
          <h2 className="font-serif text-2xl md:text-[28px] font-medium text-ink leading-tight mt-1.5">
            Nothing here yet — <em className="italic text-accent">that is the right place to start.</em>
          </h2>
          <p className="text-sm text-ink-soft mt-2 max-w-xl">
            Draft one lesson and the rest of this page fills itself in.
          </p>
          <div className="grid sm:grid-cols-2 gap-2.5 mt-4">
            {QUICK.map((a) => (
              <button
                key={a.section}
                type="button"
                onClick={() => onJump?.(a.section)}
                className={`${s.glass} ${s.tap} px-4 py-3 flex items-center gap-3`}
              >
                <a.icon size={17} className="text-accent flex-shrink-0" />
                <span className="min-w-0 text-start">
                  <span className="block text-sm text-ink">{a.title}</span>
                  <span className="block text-xs text-muted mt-0.5">{a.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* ── calendar · today · tasks ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Panel className="p-5 lg:col-span-4">
          <Head
            eyebrow={new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            title="Calendar"
            action="Schedule"
            onAction={() => onJump?.("schedule")}
          />
          {loading
            ? <div className="grid grid-cols-7 gap-1.5">{Array.from({length:28},(_,i)=><Bar key={i} w="w-full" h="h-8" />)}</div>
            : <MiniCalendar entries={data?.calendar || []} onPick={() => onJump?.("schedule")} />}
        </Panel>

        <Panel className="p-5 lg:col-span-4">
          <Head eyebrow="Today" title="Your lessons" action="Plan" onAction={() => onJump?.("planner")} />
          {loading ? (
            <div className="space-y-3">{[0,1,2].map(i => <Bar key={i} w="w-full" h="h-10" />)}</div>
          ) : today.length === 0 ? (
            <p className="text-sm text-muted py-4">Nothing scheduled today.</p>
          ) : (
            <ul className="space-y-0.5">
              {today.map((l) => (
                <li key={l.id} className="flex items-start gap-3 py-2.5 border-b border-dashed border-line last:border-0">
                  <span className="text-[11px] font-medium tracking-wider text-muted w-12 mt-0.5 flex-shrink-0 tabular-nums">
                    {fmtTime(l.start_time)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-ink leading-snug truncate">{l.title}</p>
                    <p className="text-[11.5px] text-muted mt-0.5 truncate">
                      {[l.subject, l.section || l.grade, l.location].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5 lg:col-span-4">
          <Head eyebrow="To do" title="Needs you" />
          {loading
            ? <div className="space-y-2">{[0,1,2,3].map(i => <Bar key={i} w="w-full" h="h-11" />)}</div>
            : <TaskList tasks={data?.tasks || []} onOpen={(sec) => onJump?.(sec)} />}
        </Panel>
      </div>

      {/* ── trend · library · counts ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Panel className="p-5 lg:col-span-7">
          <Head eyebrow="Last eight weeks" title={<>What you have <em>made</em></>} />
          {loading ? <Bar w="w-full" h="h-24" /> : <TrendChart data={data?.activity || []} />}
        </Panel>

        <Panel className="p-5 lg:col-span-5">
          <Head eyebrow="Library" title="By kind" action="All" onAction={() => onJump?.("lesson-plans")} />
          {loading
            ? <div className="space-y-3">{[0,1,2,3].map(i => <Bar key={i} w="w-full" h="h-7" />)}</div>
            : <TypeBreakdown
                data={data?.by_type || []}
                onPick={(k) => onJump?.({
                  lesson_plan: "lesson-plans", quiz: "quizzes", homework: "homework",
                  presentation: "presentations", activity: "activities",
                }[k])}
              />}
        </Panel>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Students", value: counts.students ?? 0, unit: "in roster", section: "database" },
          { label: "Classes",  value: counts.classes ?? 0,  unit: "active",    section: "database" },
          { label: "Library",  value: counts.total ?? 0,    unit: "items",     section: "lesson-plans" },
          plan?.credits != null
            ? { label: "Credits", value: plan.credits, unit: `of ${plan.allowance}`, section: "account" }
            : { label: "Lessons", value: counts.drafts ?? 0, unit: "plans", section: "lesson-plans" },
        ].map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => onJump?.(k.section)}
            className={`${s.glass} ${s.tap} p-4 text-start`}
          >
            <p className={s.eyebrow}>{k.label}</p>
            {loading ? <Bar w="w-14" h="h-8" /> : (
              <p className="font-serif text-[30px] leading-none text-ink mt-1.5 tabular-nums">
                {k.value}
                <span className="text-[12px] font-sans not-italic text-muted ms-1.5">{k.unit}</span>
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
