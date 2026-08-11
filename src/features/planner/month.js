// =====================================================================
// Month arithmetic, and what a month of teaching adds up to
//
// Separated from the view for the same reason the schedule's was: this
// is the part that can be checked on its own. Nothing here touches
// React or the DOM.
// =====================================================================
import { BookOpen, CalendarDays, GraduationCap, ClipboardList, Presentation, Sparkles } from "lucide-react";

/**
 * The six surfaces the calendar aggregates.
 *
 * Tints are literal, muted, and deliberately NOT the status tokens —
 * --p-ok / --p-warn / --p-crit mean something, and a homework chip drawn
 * in the danger red reads as a problem rather than as homework. Six
 * fixed hues, far enough apart to tell at the width of a 2px rule.
 */
export const KINDS = [
  { key: "schedule",      label: "Schedule",      icon: CalendarDays,  tint: "#16646c" },
  { key: "lesson-plans",  label: "Lesson plans",  icon: BookOpen,      tint: "#5b5480" },
  { key: "quizzes",       label: "Quizzes",       icon: GraduationCap, tint: "#4a6741" },
  { key: "homework",      label: "Homework",      icon: ClipboardList, tint: "#8a6a2f" },
  { key: "presentations", label: "Presentations", icon: Presentation,  tint: "#7a5c3e" },
  { key: "activities",    label: "Activities",    icon: Sparkles,      tint: "#4a5c6b" },
];

export const KIND_BY_KEY = Object.fromEntries(KINDS.map((k) => [k.key, k]));
export const tintOf = (kind) => KIND_BY_KEY[kind]?.tint || "var(--p-muted)";

/** YYYY-MM-DD from local parts — see src/lib/localDate.ts for why. */
export const isoKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const sameYMD = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * A rectangular Monday-first grid for the month containing `anchor`,
 * padded with the neighbouring months so every row has seven cells.
 */
export function monthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - lead);

  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const total = lead + last.getDate();
  const rows = Math.ceil(total / 7);

  return Array.from({ length: rows * 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Every day of the month, in order, with its events. */
export function daysOfMonth(anchor, eventsByDate) {
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  return Array.from({ length: last }, (_, i) => {
    const d = new Date(anchor.getFullYear(), anchor.getMonth(), i + 1);
    const key = isoKey(d);
    return { date: d, key, events: eventsByDate.get(key) || [] };
  });
}

/**
 * What the month adds up to.
 *
 * `done` counts schedule entries the teacher has marked done — the only
 * surface that carries a status — so "to do" is what is genuinely still
 * ahead rather than everything that is not in the past.
 */
export function monthStats(days, todayIso) {
  let total = 0, done = 0, ahead = 0;
  const perKind = new Map();

  for (const { key, events } of days) {
    for (const e of events) {
      total++;
      perKind.set(e.kind, (perKind.get(e.kind) || 0) + 1);
      if (e.raw?.status === "done") done++;
      else if (key >= todayIso) ahead++;
    }
  }

  return {
    total,
    done,
    ahead,
    percent: total ? Math.round((done / total) * 100) : 0,
    perKind,
    busiest: days.reduce((best, d) => (d.events.length > (best?.events.length || 0) ? d : best), null),
  };
}

/**
 * The tallest stack the ribbon has to draw.
 *
 * Scaling every bar to the busiest day means one heavy day flattens the
 * rest into nothing, so the ceiling is at least four — a month whose
 * heaviest day has two lessons should not render as two full-height
 * bars beside twenty-eight empty ones.
 */
export const ribbonCeiling = (days) =>
  Math.max(4, ...days.map((d) => d.events.length));
