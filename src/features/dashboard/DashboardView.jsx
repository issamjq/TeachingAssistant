"use client";

// =====================================================================
// The teacher's dashboard — a bento the teacher edits
//
// One loud card that owns the page, one dark counterweight, quiet glass
// for the rest — and the rest is the teacher's to choose. Six widgets
// show by default; the others wait behind Customize, which lives ON the
// dashboard rather than in Settings: the decision "do I want the
// calendar here" is made while looking at the calendar, and sending
// someone to another page to make it means they never will.
//
// The two charts each have two models (pills/line, bars/donut). Both
// models of each are honest renderings of the same numbers — the switch
// is about which question the teacher asks first, "which week held
// what" or "which way is it heading".
//
// Every number on this page is real.
// =====================================================================
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Sparkles, CalendarDays, FileText, HelpCircle, Users,
  SlidersHorizontal, Check, X,
} from "lucide-react";
import { api } from "@/views/_shared";
import {
  MiniCalendar, PillBars, LineTrend, Ring, WeekSchedule,
  TypeBreakdown, KindDonut, TaskList, KhatimMark,
} from "./widgets";
import { WIDGETS, CHART_MODELS, loadPrefs, savePrefs } from "./prefs";
import s from "./Dashboard.module.css";

const fmtTime = (t) => (t ? t.slice(0, 5) : "—");
const hm = (t) => { if (!t) return null; const [h, m] = t.split(":"); return Number(h) * 60 + Number(m); };

const QUICK = [
  { icon: Sparkles,   title: "Open AI Studio", hint: "Describe it; edit what comes back", section: "studio" },
  { icon: FileText,   title: "Draft a lesson", hint: "Objectives, activity, assessment",  section: "lesson-plans" },
  { icon: HelpCircle, title: "Build a quiz",   hint: "MCQ, short answer, essay",          section: "quizzes" },
  { icon: Users,      title: "Add students",   hint: "Register, attendance, marks",       section: "database" },
];

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

/**
 * The customize panel. Checkboxes for widgets, a model switch for each
 * chart. Changes apply as they are made — a preview beats an Apply
 * button, because the dashboard is right there behind the panel.
 */
function Customize({ prefs, onChange, onClose }) {
  const toggle = (key) => {
    const visible = prefs.visible.includes(key)
      ? prefs.visible.filter((k) => k !== key)
      : [...prefs.visible, key];
    onChange({ ...prefs, visible });
  };
  const setModel = (chart, id) =>
    onChange({ ...prefs, charts: { ...prefs.charts, [chart]: id } });

  return (
    <section className={`${s.glass} p-5 relative`} aria-label="Customize dashboard">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className={s.eyebrow}>Customize</p>
          <h2 className={s.title}>Your dashboard, your call</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Done customizing"
          className="grid place-items-center w-8 h-8 rounded-full text-muted hover:bg-paper-warm hover:text-ink transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
        {WIDGETS.map((w) => {
          const on = prefs.visible.includes(w.key);
          return (
            <label
              key={w.key}
              className={`flex items-center gap-3 py-2 ${w.locked ? "opacity-50" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                disabled={w.locked}
                onChange={() => !w.locked && toggle(w.key)}
              />
              <span
                aria-hidden="true"
                className={`grid place-items-center w-5 h-5 rounded-md border transition-colors ${
                  on ? "bg-accent border-accent text-on-accent" : "border-line-strong bg-paper-cool"
                }`}
              >
                {on && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="text-[13.5px] text-ink flex-1">{w.label}</span>
              {CHART_MODELS[w.key] && on && (
                <span className={s.seg} role="radiogroup" aria-label={`${w.label} chart style`}>
                  {CHART_MODELS[w.key].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={prefs.charts[w.key] === m.id}
                      data-on={prefs.charts[w.key] === m.id}
                      className={`${s.segBtn} !h-7 !px-3 !text-[11px]`}
                      onClick={(e) => { e.preventDefault(); setModel(w.key, m.id); }}
                    >
                      {m.label}
                    </button>
                  ))}
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p className="text-[11.5px] text-muted mt-3">
        Remembered on this device. The greeting always shows.
      </p>
    </section>
  );
}

export default function DashboardView({ onJump }) {
  const [me, setMe] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  // Defaults first, real prefs after mount — localStorage does not exist
  // during server rendering, and a hydration mismatch is worse than one
  // frame of the default layout.
  const [prefs, setPrefs] = useState(() => ({ visible: WIDGETS.filter((w) => w.locked || w.default).map((w) => w.key), charts: { rhythm: "pills", kinds: "bars" } }));

  useEffect(() => { setPrefs(loadPrefs()); }, []);

  const changePrefs = (next) => { setPrefs(next); savePrefs(next); };
  const show = (key) => prefs.visible.includes(key);

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
  const calendar = data?.calendar || [];
  const status = useMemo(() => nowLesson(today), [today]);
  const isNew = !loading && !error && (counts.total ?? 0) === 0 && today.length === 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  let headline, sub;
  if (status.mode === "live") {
    headline = <>Right now — <em className="italic">{status.lesson.title || "your class"}</em></>;
    sub = `${status.left} min left · ${status.lesson.section || status.lesson.grade || "your group"}`;
  } else if (status.mode === "next") {
    headline = <>Next up — <em className="italic">{status.lesson.title || "your next class"}</em></>;
    sub = status.until < 60
      ? `in ${status.until} min · ${fmtTime(status.lesson.start_time)}`
      : `at ${fmtTime(status.lesson.start_time)}`;
  } else {
    headline = <>{greeting}, <em className="italic">{me?.first_name || "there"}</em></>;
    sub = today.length ? "Nothing more on the schedule today." : "A clear day. Make something with it.";
  }

  const stats = [
    { label: "Students",  value: counts.students ?? 0, unit: "in your roster",  section: "database" },
    { label: "Library",   value: counts.total ?? 0,    unit: "things you made", section: "lesson-plans" },
    { label: "Scheduled", value: calendar.length,      unit: "next 14 days",    section: "schedule" },
  ];

  const kindsPick = (k) => onJump?.({
    lesson_plan: "lesson-plans", quiz: "quizzes", homework: "homework",
    presentation: "presentations", activity: "activities",
  }[k]);

  return (
    <div className="space-y-4">
      {/* ── customize toggle, on the page it customizes ─────────────── */}
      <div className="flex justify-end -mb-2">
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-expanded={editing}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-line bg-surface/70 text-[12px] text-ink-soft hover:border-accent hover:text-ink transition-colors cursor-pointer"
        >
          <SlidersHorizontal size={13} />
          {editing ? "Done" : "Customize"}
        </button>
      </div>

      {editing && <Customize prefs={prefs} onChange={changePrefs} onClose={() => setEditing(false)} />}

      {/* ── row 1 · the loud card and its counterweight ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className={`${s.loud} p-6 md:p-8 ${show("runway") ? "lg:col-span-8" : "lg:col-span-12"} flex flex-col justify-between min-h-[220px]`}>
          <KhatimMark className={s.loudMark} />
          <div className="relative">
            <p className={s.loudEyebrow}>{dateLine}</p>
            <h1 className="font-serif text-[30px] md:text-[40px] leading-[1.05] font-medium mt-2.5 max-w-xl">
              {headline}
            </h1>
            <p className={`${s.loudSub} text-sm mt-2`}>{sub}</p>
          </div>
          <div className="relative flex flex-wrap gap-2.5 mt-6">
            <button type="button" className={s.btnOnLoud} onClick={() => onJump?.("studio")}>
              <Sparkles size={15} /> Open AI Studio
            </button>
            <button type="button" className={s.btnGhostOnLoud} onClick={() => onJump?.("planner")}>
              <CalendarDays size={15} /> Plan the week
            </button>
          </div>
        </section>

        {show("runway") && (
          <section className={`${s.ink} p-6 lg:col-span-4 flex flex-col justify-between min-h-[220px]`}>
            {plan ? (
              <>
                <p className={s.inkEyebrow}>
                  {plan.status === "trialing" ? "Free trial" : `${plan.plan} plan`}
                </p>
                <div className="flex items-end justify-between gap-4 mt-3">
                  <div>
                    <p className={s.figure}>{plan.days_left ?? "∞"}</p>
                    <p className={`${s.inkMuted} text-[12.5px] mt-1.5`}>
                      {plan.days_left === 1 ? "day left" : "days left"}
                      {plan.status === "trialing" ? " — then choose a plan" : ""}
                    </p>
                  </div>
                  {plan.credits != null && (
                    <Ring value={plan.credits} max={plan.allowance || 1} size={92}>
                      <span className="text-center leading-none">
                        <span className="block font-serif text-[19px]">{plan.credits}</span>
                        <span className={`${s.inkMuted} block text-[8.5px] font-mono uppercase tracking-widest mt-1`}>
                          credits
                        </span>
                      </span>
                    </Ring>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onJump?.("account")}
                  className="mt-5 self-start text-[12.5px] underline underline-offset-4 decoration-1 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  Manage plan
                </button>
              </>
            ) : (
              <>
                <p className={s.inkEyebrow}>Your library</p>
                <p className={`${s.figure} mt-3`}>{counts.total ?? 0}</p>
                <p className={`${s.inkMuted} text-[12.5px] mt-1.5`}>things made so far</p>
              </>
            )}
          </section>
        )}
      </div>

      {plan && plan.days_left != null && plan.days_left <= 3 && (
        <div className={`${s.glass} px-4 py-3 flex items-center gap-3 flex-wrap`}>
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
        </div>
      )}

      {error && (
        <div className={`${s.glass} p-4`}>
          <p className={s.eyebrow}>Could not load the dashboard</p>
          <p className="text-sm text-ink-soft mt-1">{error}</p>
        </div>
      )}

      {isNew && (
        <section className={`${s.glassRaised} p-5 md:p-6`}>
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
        </section>
      )}

      {/* ── row 2 · the numerals ────────────────────────────────────── */}
      {show("stats") && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={() => onJump?.(k.section)}
              className={`${s.glass} ${s.tap} p-5`}
            >
              <p className={s.eyebrow}>{k.label}</p>
              {loading ? <Bar w="w-16" h="h-10" /> : (
                <p className={`${s.figure} text-ink mt-2`}>{k.value}</p>
              )}
              <p className="text-[12px] text-muted mt-1.5">{k.unit}</p>
            </button>
          ))}
        </div>
      )}

      {/* ── row 3 · rhythm and the month ────────────────────────────── */}
      {(show("rhythm") || show("calendar")) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {show("rhythm") && (
            <section className={`${s.glass} p-5 md:p-6 ${show("calendar") ? "lg:col-span-7" : "lg:col-span-12"} flex flex-col`}>
              <Head eyebrow="Last eight weeks" title={<>Your <em>rhythm</em></>} />
              <div className="flex-1 min-h-[150px] flex flex-col justify-end">
                {loading ? <Bar w="w-full" h="h-28" />
                  : prefs.charts.rhythm === "line"
                    ? <LineTrend data={data?.activity || []} />
                    : <PillBars data={data?.activity || []} />}
              </div>
            </section>
          )}
          {show("calendar") && (
            <section className={`${s.glass} p-5 ${show("rhythm") ? "lg:col-span-5" : "lg:col-span-6"}`}>
              <Head
                eyebrow={new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                title="Calendar"
                action="Schedule"
                onAction={() => onJump?.("schedule")}
              />
              {loading
                ? <div className="grid grid-cols-7 gap-1.5">{Array.from({ length: 28 }, (_, i) => <Bar key={i} w="w-full" h="h-8" />)}</div>
                : <MiniCalendar entries={calendar} onPick={() => onJump?.("schedule")} />}
            </section>
          )}
        </div>
      )}

      {/* ── row 4 · the optional trio ───────────────────────────────── */}
      {(show("week") || show("tasks") || show("kinds")) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {show("week") && (
            <section className={`${s.glass} p-5 lg:col-span-4`}>
              <Head eyebrow="Coming up" title="This week" action="Plan" onAction={() => onJump?.("planner")} />
              {loading
                ? <div className="space-y-2">{[0, 1, 2].map((i) => <Bar key={i} w="w-full" h="h-12" />)}</div>
                : <WeekSchedule entries={calendar} onOpen={() => onJump?.("schedule")} />}
            </section>
          )}
          {show("tasks") && (
            <section className={`${s.glass} p-5 ${show("week") && show("kinds") ? "lg:col-span-4" : show("week") || show("kinds") ? "lg:col-span-6" : "lg:col-span-8"}`}>
              <Head eyebrow="To do" title="Needs you" />
              {loading
                ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Bar key={i} w="w-full" h="h-11" />)}</div>
                : <TaskList tasks={data?.tasks || []} onOpen={(sec) => onJump?.(sec)} />}
            </section>
          )}
          {show("kinds") && (
            <section className={`${s.glass} p-5 ${show("week") && show("tasks") ? "lg:col-span-4" : "lg:col-span-6"}`}>
              <Head eyebrow="Library" title="By kind" action="All" onAction={() => onJump?.("lesson-plans")} />
              {loading
                ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Bar key={i} w="w-full" h="h-7" />)}</div>
                : prefs.charts.kinds === "donut"
                  ? <KindDonut data={data?.by_type || []} onPick={kindsPick} />
                  : <TypeBreakdown data={data?.by_type || []} onPick={kindsPick} />}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
