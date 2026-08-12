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

/* ── the week, and where in the day things sit ─────────────────────
   The time-grid views need three things the month never did: which
   seven days make a week, where a clock time lands vertically, and how
   to lay out entries that overlap. All pure, all checkable alone. */

/** Monday-first week containing `anchor` — the teaching week, and the
    same convention the month grid and the dashboard strip use. */
export function weekOf(anchor) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** "HH:MM[:SS]" → minutes since midnight, or null. */
export const toMin = (t) => {
  if (typeof t !== "string") return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  return m ? Math.min(1439, Number(m[1]) * 60 + Number(m[2])) : null;
};

/**
 * The hour window a set of timed events needs.
 *
 * A 24-hour rail is mostly night: it scrolls the school day out of
 * sight to show sixteen empty rows. The window is the school day
 * (07:00–17:00) stretched — never shrunk — to fit whatever is actually
 * scheduled, so a 06:30 exam or an evening meeting is still on the rail.
 */
export function hourWindow(events) {
  let start = 7 * 60, end = 17 * 60;
  for (const e of events) {
    const a = toMin(e.raw?.start_time);
    if (a == null) continue;
    const b = toMin(e.raw?.end_time) ?? a + 55;
    if (a < start) start = Math.floor(a / 60) * 60;
    if (b > end) end = Math.ceil(b / 60) * 60;
  }
  return { start, end };
}

/**
 * Column assignment for one day's timed entries, the way a calendar
 * drawer does it: sweep by start time, give each entry the leftmost
 * column that is free, and remember how wide the crowd got so every
 * member of an overlapping cluster divides the day column evenly.
 *
 * Returns [{ event, startMin, endMin, col, cols }].
 */
export function layoutDay(events) {
  const timed = events
    .map((e) => {
      const startMin = toMin(e.raw?.start_time);
      if (startMin == null) return null;
      const endRaw = toMin(e.raw?.end_time);
      // A missing end is one period; a zero/negative span still needs
      // enough height to grab.
      const endMin = Math.max(startMin + 30, endRaw ?? startMin + 55);
      return { event: e, startMin, endMin };
    })
    .filter(Boolean)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const colEnds = [];        // per column, when it frees up
  let cluster = [];          // entries sharing any overlap
  let clusterMaxEnd = -1;

  const flush = () => {
    const cols = colEnds.length || 1;
    for (const x of cluster) x.cols = cols;
    cluster = [];
    colEnds.length = 0;
  };

  for (const x of timed) {
    if (cluster.length && x.startMin >= clusterMaxEnd) flush();
    let col = colEnds.findIndex((end) => end <= x.startMin);
    if (col === -1) { col = colEnds.length; colEnds.push(0); }
    colEnds[col] = x.endMin;
    x.col = col;
    cluster.push(x);
    clusterMaxEnd = Math.max(clusterMaxEnd, x.endMin);
  }
  flush();
  return timed;
}
