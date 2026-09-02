// Turning a plan into dates.
//
// The planner writes weeks, and a week holds days — but "day 2 of week 3"
// is not an hour in anyone's timetable. A teacher teaches 7B on Sunday
// and Tuesday, second period; that pattern plus a start date is what
// turns a scheme of work into a term she can actually be handed.
//
// Deliberately in the browser and deliberately simple arithmetic. The
// service will emit dated days itself once it takes a start date
// (todo/backend/12-goal-days.md), and this becomes the fallback rather
// than the path — but a teacher should not wait for that to put her own
// plan on her own calendar.

/** Sunday-first, which is the UAE school week. */
export const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export interface PlanDay {
  week: number;
  day_index: number;
  title: string;
  outline?: string | null;
  outcomes?: string[] | null;
  date?: string | null;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Every day the plan contains, in teaching order, flattened out of the
 * week structure.
 *
 * Two shapes have shipped: `days: [{day, title, outline}]` is current,
 * `lessons: ["…"]` is older and still rendered, so both are read. A week
 * with neither still counts as a week — it just contributes no days,
 * which is what an unplanned reading week looks like.
 */
export function daysFromPlan(plan: any): PlanDay[] {
  const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
  const out: PlanDay[] = [];
  weeks.forEach((w: any, wi: number) => {
    const weekNo = Number(w?.week) || wi + 1;
    const days = Array.isArray(w?.days) && w.days.length
      ? w.days
      : Array.isArray(w?.lessons)
        ? w.lessons.map((l: any, i: number) => ({ day: i + 1, title: typeof l === "string" ? l : l?.title }))
        : [];
    days.forEach((d: any, di: number) => {
      const title = String(d?.title || "").trim();
      if (!title) return;
      out.push({
        week: weekNo,
        day_index: di,
        title,
        outline: d?.outline ?? null,
        outcomes: Array.isArray(d?.outcomes) && d.outcomes.length ? d.outcomes : null,
      });
    });
  });
  return out;
}

/**
 * Give each day a date.
 *
 * Walks forward from `startDate`, handing out the chosen weekdays in
 * order and moving to the next calendar week when the pattern runs out.
 * The plan's own week numbers are NOT used as an offset — a plan that
 * calls its first week "week 3" would otherwise start a fortnight late,
 * and the teacher's start date is the more trustworthy statement.
 *
 * A day whose weekday list is empty comes back undated; the caller can
 * still save it and place it by hand.
 */
export function placeDays(
  days: PlanDay[],
  startDate: string,
  weekdays: number[],
): PlanDay[] {
  const picks = [...new Set(weekdays)].sort((a, b) => a - b);
  if (!picks.length || !startDate) return days.map((d) => ({ ...d, date: null }));

  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return days.map((d) => ({ ...d, date: null }));

  // The first slot on or after the start date, so a term beginning
  // mid-week does not book a lesson into the day before it began.
  const cursor = new Date(start);
  while (!picks.includes(cursor.getDay())) cursor.setDate(cursor.getDate() + 1);

  let slot = picks.indexOf(cursor.getDay());
  const weekAnchor = new Date(cursor);

  return days.map((d, i) => {
    if (i > 0) {
      slot += 1;
      if (slot >= picks.length) {
        slot = 0;
        weekAnchor.setDate(weekAnchor.getDate() + 7);
      }
      const base = new Date(weekAnchor);
      base.setDate(base.getDate() + (picks[slot] - base.getDay()));
      cursor.setTime(base.getTime());
    }
    return { ...d, date: iso(cursor) };
  });
}

/** How long the placed plan runs, said the way a teacher would say it. */
export function spanOf(days: PlanDay[]): string {
  const dated = days.map((d) => d.date).filter(Boolean).sort() as string[];
  if (!dated.length) return "";
  const fmt = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return dated.length === 1 ? fmt(dated[0]) : `${fmt(dated[0])} – ${fmt(dated[dated.length - 1])}`;
}
