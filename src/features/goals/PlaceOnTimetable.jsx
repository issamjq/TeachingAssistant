"use client";

// "Put this term on my timetable."
//
// The plan was a picture. Weeks, days, a focus, an assessment — and no
// way to turn any of it into an hour in a real week, so a teacher read
// her own plan and retyped each day into the Studio by hand. The screen
// said so out loud.
//
// This is the missing verb. She says which class, when it starts and
// which days she teaches it; every day of the plan becomes a dated row
// (goal_days, §97) and a slot on her timetable. From there each day can
// be drafted, and it remembers what was written for it.

import React, { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Check, Sparkles, ExternalLink } from "lucide-react";
import { api } from "@/views/_shared";
import { useRoster } from "@/features/delivery";
import { distinctClasses, classLabel } from "@/shared/lib/classMatch";
import { flash } from "@/shared/lib/flash";
import { navigate } from "@/lib/route";
import { PREFILL_KEY } from "@/shared/lib/assistantPrefill";
import { daysFromPlan, placeDays, spanOf, WEEKDAYS } from "./placePlan";
import s from "./Goals.module.css";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Hand one day to the Studio.
 *
 * Not a new AI endpoint: the composer already accepts a parked brief,
 * and reusing it means this works today rather than waiting on the
 * service. The day's title and outline ARE the brief — she wrote them,
 * or approved them, when the plan was made.
 */
function draftDay(goal, day) {
  const brief = [
    day.title,
    day.outline || "",
    day.outcomes?.length ? `Outcomes: ${day.outcomes.join("; ")}` : "",
    goal.subject || goal.grade
      ? `For ${[goal.grade, goal.section, goal.subject].filter(Boolean).join(" · ")}.`
      : "",
    day.date ? `It is taught on ${day.date}.` : "",
  ].filter(Boolean).join("\n\n");

  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify({
      action: "create_work", prompt: brief, kind: "lesson_plan",
      // Travels to the service on the generate call, which sets the
      // day's draft_id and marks it drafted — so the plan stops
      // offering to write Tuesday's lesson a second time.
      goal_day_id: day.id,
      at: Date.now(),
    }));
  } catch { /* a brief she can retype is better than a crash */ }
  navigate(["studio"]);
}

export default function PlaceOnTimetable({ goal, onPlaced }) {
  const { roster } = useRoster();
  /**
   * Her real classes, plus the one this goal is FOR.
   *
   * The list came only from the roster, so a goal for "Grade 8 Science"
   * on an account whose only class is Grade 9 · A · Maths offered
   * nothing she could pick — the plan was unplaceable and the screen
   * gave no way out. A goal that already names its class carries that
   * class as an option, listed first, whether or not anyone is enrolled
   * in it yet.
   */
  const classes = useMemo(() => {
    const fromRoster = distinctClasses(roster);
    if (!goal.grade) return fromRoster;
    const same = (c) =>
      c.grade === goal.grade &&
      (c.subject || null) === (goal.subject || null) &&
      (c.section || null) === (goal.section || null);
    if (fromRoster.some(same)) return fromRoster;
    return [
      { grade: goal.grade, subject: goal.subject, section: goal.section, count: 0 },
      ...fromRoster,
    ];
  }, [roster, goal.grade, goal.subject, goal.section]);

  const planDays = useMemo(() => daysFromPlan(goal.plan), [goal.plan]);
  const [days, setDays] = useState(null);          // saved goal_days rows
  const [loading, setLoading] = useState(true);

  const [cls, setCls] = useState(() =>
    goal.grade ? { grade: goal.grade, section: goal.section, subject: goal.subject } : null);
  const [start, setStart] = useState(goal.start_date || todayISO());
  /**
   * How many days a week the plan actually needs.
   *
   * A fixed Sun+Tue default contradicted the plan it was placing: ten
   * teaching days across two weeks is five a week, and spreading them
   * over two put the last lesson a month past the end of the unit. The
   * plan knows its own shape — the busiest week in it — so the default
   * follows that, and she moves the days rather than the count.
   */
  const perWeek = useMemo(() => {
    if (goal.periods_per_week) return Math.min(5, Math.max(1, goal.periods_per_week));
    const byWeek = new Map();
    for (const d of planDays) byWeek.set(d.week, (byWeek.get(d.week) || 0) + 1);
    return Math.min(5, Math.max(1, ...(byWeek.size ? [...byWeek.values()] : [2])));
  }, [goal.periods_per_week, planDays]);

  // Spread across the teaching week rather than bunched: 2 → Sun+Tue,
  // 3 → Sun+Tue+Thu, 5 → the whole week.
  const [picked, setPicked] = useState(() =>
    ({ 1: [0], 2: [0, 2], 3: [0, 2, 4], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 4] })[perWeek] || [0, 2]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api(`/api/goals/${goal.id}/days`)
      .then((r) => { if (live) { setDays(Array.isArray(r) ? r : []); setLoading(false); } })
      .catch(() => { if (live) { setDays([]); setLoading(false); } });
    return () => { live = false; };
  }, [goal.id]);

  const preview = useMemo(
    () => placeDays(planDays, start, picked),
    [planDays, start, picked],
  );

  const placed = days?.length ? days : null;
  const scheduledCount = placed?.filter((d) => d.schedule_entry_id).length || 0;

  const toggleDay = (v) =>
    setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v].sort((a, b) => a - b)));

  /**
   * Save the days, then give each one an hour.
   *
   * Sequential and tolerant: a slot that fails to save leaves the day
   * planned rather than aborting the term, and the count reports exactly
   * how far it got. The same honesty the weekly repeat uses.
   */
  const place = async () => {
    if (!cls?.grade || !cls?.subject) {
      flash("Pick the class first — students receive work by grade and subject.");
      return;
    }
    if (!picked.length) {
      flash("Pick at least one day of the week.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/goals/${goal.id}`, {
        method: "PATCH",
        body: {
          grade: cls.grade, subject: cls.subject, section: cls.section || null,
          start_date: start, periods_per_week: picked.length,
        },
      });

      const saved = await api(`/api/goals/${goal.id}/days`, {
        method: "POST",
        body: { days: preview },
      });

      let placedCount = 0;
      for (const d of saved) {
        if (!d.date || d.schedule_entry_id) continue;
        try {
          const entry = await api("/api/schedule", {
            method: "POST",
            body: {
              title: d.title,
              subject: cls.subject, grade: cls.grade, section: cls.section || "",
              date: d.date, status: "planned",
              notes: d.outline || null,
            },
          });
          await api(`/api/goal-days/${d.id}`, {
            method: "PATCH",
            body: { schedule_entry_id: entry.id, status: "scheduled" },
          });
          placedCount += 1;
        } catch {
          break; // report what landed rather than pretending the rest did
        }
      }

      const fresh = await api(`/api/goals/${goal.id}/days`);
      setDays(Array.isArray(fresh) ? fresh : []);
      onPlaced?.();
      flash(
        placedCount === saved.length
          ? `${placedCount} lesson${placedCount === 1 ? "" : "s"} on your timetable.`
          : `${placedCount} of ${saved.length} placed — the rest are saved and can be added again.`,
      );
    } catch (e) {
      flash(`Could not place the plan: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!planDays.length) return null;

  return (
    <section className="mt-6 pt-5 border-t border-line">
      <p className={s.eyebrow}>On the timetable</p>

      {loading ? null : placed ? (
        <>
          <p className="text-[13.5px] text-ink-soft mt-1.5 mb-3">
            {scheduledCount
              ? `${scheduledCount} of ${placed.length} lessons are on your week${
                  spanOf(placed) ? ` — ${spanOf(placed)}` : ""
                }.`
              : `${placed.length} days saved, none placed yet.`}
          </p>
          <ol className="space-y-1.5">
            {placed.map((d) => (
              <li
                key={d.id}
                className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5"
              >
                <span className="flex-none font-mono text-[10px] uppercase tracking-wider text-muted pt-0.5 w-[4.5rem]">
                  {d.date
                    ? new Date(`${d.date}T00:00:00`).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short",
                      })
                    : `Wk ${d.week}`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-ink">{d.title}</span>
                  {d.outline && (
                    <span className="block text-[12.5px] text-muted mt-0.5 line-clamp-2">
                      {d.outline}
                    </span>
                  )}
                </span>
                <span className="flex-none flex items-center gap-2 pt-0.5">
                  {d.draft_id ? (
                    <span
                      className="font-mono text-[10px] uppercase tracking-wider text-ok inline-flex items-center gap-1"
                      title="A lesson has been drafted for this day"
                    >
                      <Check size={12} aria-hidden /> Drafted
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => draftDay({ ...goal, ...cls }, d)}
                      className="inline-flex items-center gap-1.5 text-[12px] text-accent hover:underline"
                    >
                      <Sparkles size={12} aria-hidden /> Draft this
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => navigate(["planner"])}
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink"
          >
            <ExternalLink size={12} aria-hidden /> See it on the calendar
          </button>
        </>
      ) : (
        <>
          <p className="text-[13.5px] text-ink-soft mt-1.5 mb-4 max-w-[54ch]">
            {planDays.length} teaching day{planDays.length === 1 ? "" : "s"} in this plan.
            Say which class and when you teach it, and each one becomes a lesson
            on your week.
          </p>

          <div className="grid gap-3.5 max-w-md">
            <label className="block">
              <span className={s.label}>Which class</span>
              <select
                className={s.field}
                value={cls ? `${cls.grade}|${cls.section || ""}|${cls.subject || ""}` : ""}
                onChange={(e) => {
                  const [grade, section, subject] = e.target.value.split("|");
                  setCls(grade ? { grade, section: section || null, subject: subject || null } : null);
                }}
              >
                <option value="">Pick a class…</option>
                {classes.map((c) => (
                  <option
                    key={`${c.grade}|${c.section || ""}|${c.subject || ""}`}
                    value={`${c.grade}|${c.section || ""}|${c.subject || ""}`}
                  >
                    {classLabel(c)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={s.label}>Starting</span>
              <input type="date" className={s.field} value={start}
                     onChange={(e) => setStart(e.target.value)} />
            </label>

            <div>
              <span className={s.label}>Days you teach it</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    aria-pressed={picked.includes(d.value)}
                    className={`h-8 px-3 rounded-full border text-[12px] ${
                      picked.includes(d.value)
                        ? "border-ink bg-ink text-paper"
                        : "border-line text-ink-soft"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* What it will look like, before anything is written. A term
              laid on the wrong days is a lot to undo by hand. */}
          {preview[0]?.date && (
            <p className="text-[12.5px] text-muted mt-3">
              First lesson {new Date(`${preview[0].date}T00:00:00`).toLocaleDateString("en-GB", {
                weekday: "long", day: "numeric", month: "long",
              })}
              , last on {new Date(`${preview[preview.length - 1].date}T00:00:00`).toLocaleDateString("en-GB", {
                weekday: "long", day: "numeric", month: "long",
              })}.
            </p>
          )}

          <button
            type="button"
            onClick={place}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-ink text-paper text-sm font-medium disabled:opacity-45"
          >
            <CalendarPlus size={15} aria-hidden />
            {busy ? "Placing…" : `Put ${planDays.length} lesson${planDays.length === 1 ? "" : "s"} on my timetable`}
          </button>
        </>
      )}
    </section>
  );
}
