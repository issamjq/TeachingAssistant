// Weekly repetition for schedule entries — the arithmetic, in one place.
//
// A standard 30-period week over a 14-week term is ~420 hand-entered
// rows without this; no real teacher will type them. Repetition is
// expansion at save time: one entry per week, each an ordinary row the
// teacher can edit or cancel on its own. No recurrence rule is stored,
// so nothing else in the product (delivery, attendance, the calendars)
// has to learn a second shape of entry.

/** "2026-09-01" + n days → "2026-09-08", in local parts (no TZ drift). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Hard ceiling on one save — two terms of Sundays, not a runaway loop. */
export const MAX_WEEKS = 26;

/**
 * Every date from `start`, stepping 7 days, up to and including `until`.
 * Bad input degrades to just the start date — a save must never expand
 * into nothing or into an unbounded series.
 */
export function repeatDates(start: string, until: string | null | undefined): string[] {
  if (!start) return [];
  if (!until || until < start) return [start];
  const out: string[] = [];
  let d = start;
  while (d <= until && out.length < MAX_WEEKS) {
    out.push(d);
    d = addDays(d, 7);
  }
  return out;
}
