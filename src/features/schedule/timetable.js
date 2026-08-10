// =====================================================================
// The arithmetic behind the week grid
//
// Kept out of the component because it is the part that can be reasoned
// about on its own: minutes since midnight, where a block sits in a
// column, which colour a subject gets, and what a week adds up to.
// =====================================================================

/** "08:30:00" or "08:30" → 510. Null for anything unparseable. */
export function minutesOf(time) {
  if (!time) return null;
  const [h, m] = String(time).slice(0, 5).split(":");
  const hh = Number(h), mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

export const fmtTime = (t) => (t ? String(t).slice(0, 5) : "");

/** 510 → "08:30". */
export function fmtMinutes(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const startOfWeek = (d) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday = 0
  x.setHours(0, 0, 0, 0);
  return x;
};

/**
 * How much of the day the grid draws.
 *
 * Not a fixed 00:00–24:00: eight of those hours are the middle of the
 * night and would squeeze every real lesson into a sliver. It is the
 * span the week actually occupies, rounded out to whole hours, with a
 * floor of 08:00–15:00 so a light week still looks like a school day
 * rather than one enormous period.
 */
export function dayWindow(entries, { min = 8 * 60, max = 15 * 60 } = {}) {
  let lo = min, hi = max;
  for (const e of entries) {
    const s = minutesOf(e.start_time);
    const t = minutesOf(e.end_time);
    if (s != null) lo = Math.min(lo, s);
    if (s != null) hi = Math.max(hi, t ?? s + 45);
    if (t != null) hi = Math.max(hi, t);
  }
  // A whole hour either side, so nothing is flush against the edge.
  lo = Math.max(0, Math.floor(lo / 60) * 60 - 30);
  hi = Math.min(24 * 60, Math.ceil(hi / 60) * 60 + 30);
  if (hi - lo < 240) hi = Math.min(24 * 60, lo + 240);
  return { from: lo, to: hi };
}

/**
 * Where a lesson sits in its column, as percentages of the window.
 *
 * A 40-minute period at 56px/hour is 37px, which is legible; anything
 * shorter is not, so very short entries are floored to a readable height
 * rather than drawn to scale. Being 4px generous about a 15-minute
 * registration beats rendering a strip nobody can click.
 */
export function placement(entry, win) {
  const start = minutesOf(entry.start_time);
  if (start == null) return null;
  const end = minutesOf(entry.end_time) ?? start + 45;
  const span = win.to - win.from;
  const top = ((start - win.from) / span) * 100;
  const raw = ((Math.max(end, start + 20) - start) / span) * 100;
  return { top: Math.max(0, top), height: Math.max(raw, (25 / span) * 100) };
}

/**
 * A stable colour per subject.
 *
 * Hashed rather than assigned, so Physics is the same colour every week
 * and on every device with no palette to store and no drift when a
 * subject is added.
 *
 * Literal hues rather than tokens, and deliberately. The obvious move is
 * to reuse --p-ok / --p-warn / --p-crit, and it is wrong: those carry
 * meaning. Drawing Mathematics in --p-crit painted every maths lesson in
 * the same red this screen uses for a CANCELLED one, so a full timetable
 * read as a week of disasters. A subject is not a status and must never
 * be able to look like one.
 *
 * Both palettes are cream-grounded, so one muted editorial set sits
 * correctly on either. Five is enough to separate one teacher's subjects
 * and few enough that they stay tellable apart at the width of a 2.5px
 * rule, with none of them shouting louder than the accent.
 */
const TINTS = [
  "#16646c", // firozeh — the house teal
  "#7a5c3e", // clay
  "#4a6741", // olive
  "#5b5480", // muted indigo
  "#8a6a2f", // ochre
];

export function tintFor(subject) {
  const key = String(subject || "").trim().toLowerCase();
  if (!key) return "var(--p-muted)";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * What the week adds up to.
 *
 * Teaching hours counts scheduled minutes, so an entry with no times
 * contributes to the lesson count but not to the load — which is honest:
 * nobody knows how long it is.
 */
export function weekSummary(entries, todayIso) {
  let minutes = 0;
  const perDay = new Map();

  for (const e of entries) {
    const day = String(e.date).slice(0, 10);
    perDay.set(day, (perDay.get(day) || 0) + 1);
    const s = minutesOf(e.start_time);
    const t = minutesOf(e.end_time);
    if (s != null && t != null && t > s) minutes += t - s;
  }

  let busiest = null;
  for (const [day, n] of perDay) {
    if (!busiest || n > busiest.n) busiest = { day, n };
  }

  // The next lesson still to come today, then the next day that has one.
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const upcoming = entries
    .filter((e) => {
      const day = String(e.date).slice(0, 10);
      if (day > todayIso) return true;
      if (day < todayIso) return false;
      const s = minutesOf(e.start_time);
      return s == null || s >= nowMins;
    })
    .sort((a, b) => {
      const d = String(a.date).localeCompare(String(b.date));
      if (d !== 0) return d;
      return (minutesOf(a.start_time) ?? 1e9) - (minutesOf(b.start_time) ?? 1e9);
    });

  return {
    count: entries.length,
    hours: minutes / 60,
    busiest,
    next: upcoming[0] || null,
  };
}
