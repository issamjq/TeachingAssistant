// Warn-don't-block clash detection for schedule entries.
//
// Browser-side by design: one read of the day's entries through the data
// layer (Supabase, RLS-scoped), no API service involved. Two windows
// overlap when each starts before the other ends. Times are "HH:MM"
// strings, which compare correctly as text. An entry without an end time
// is treated as filling the rest of the hour, so back-to-back lessons
// don't false-alarm but a real double-booking does.
import { api } from "./apiClient";
import { audienceOverlaps } from "./audience";

export const HHMM = (t?: string | null) => (t ? String(t).slice(0, 5) : "");

/**
 * When an entry finishes. A missing end time means "the rest of the
 * hour", which is what keeps back-to-back lessons from false-alarming.
 *
 * The result is always LATER than the start: `+1h` on a 23:30 start
 * clamps to 23:30 and would make a zero-length window that could never
 * clash with anything, and a teacher who types an end before the start
 * would get the same silence. Both fall back to end-of-day.
 */
const endOf = (start: string, end: string) => {
  if (end && end > start) return end;
  const bumped = `${String(Math.min(23, +start.slice(0, 2) + 1)).padStart(2, "0")}${start.slice(2)}`;
  return bumped > start ? bumped : "23:59";
};

export interface ScheduleRow {
  id: string;
  title: string;
  grade?: string | null;
  section?: string | null;
  date?: string;
  start_time?: string | null;
  end_time?: string | null;
  status?: string;
}

export interface ClashCandidate {
  grade?: string | null;
  section?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

/**
 * Do these two entries collide? The whole rule, with no I/O — which is
 * what makes it checkable on its own.
 *
 * Audience fields can hold lists ("Grade 9, Grade 11"), so a clash needs
 * a shared grade AND a shared section, with empty meaning everyone. A
 * cancelled entry, or one with no start time, occupies nothing.
 */
export function entriesClash(a: ClashCandidate, b: ScheduleRow): boolean {
  if (!a.start_time || !b.start_time) return false;
  if (b.status === "cancelled") return false;
  if (!audienceOverlaps(a.grade, b.grade)) return false;
  if (!audienceOverlaps(a.section, b.section)) return false;
  const as = HHMM(a.start_time);
  const bs = HHMM(b.start_time);
  return as < endOf(bs, HHMM(b.end_time)) && bs < endOf(as, HHMM(a.end_time));
}

/**
 * The first existing entry that clashes with the payload, or null.
 *
 * Same date, same audience — an entry with no grade/section holds the
 * teacher's whole slot, so it matches everything — and overlapping
 * times. A failed read returns null: the check must never stop a save.
 */
export async function findClash(
  payload: { date: string; start_time?: string | null; end_time?: string | null; grade?: string; section?: string },
  selfId: string | null = null,
): Promise<ScheduleRow | null> {
  const hit = await findClashes(payload, [payload.date], selfId);
  return hit?.row || null;
}

/**
 * The first clash across a whole series, or null.
 *
 * A weekly repeat asked this question once, about its first date, and
 * then wrote thirteen more rows unchecked — so a term laid over an
 * existing series double-booked in silence while the UI presented
 * itself as having looked. One read spans the range; the rows are
 * bucketed by date and each occurrence is tested against its own day.
 */
export async function findClashes(
  payload: { start_time?: string | null; end_time?: string | null; grade?: string; section?: string },
  dates: string[],
  selfId: string | null = null,
): Promise<{ date: string; row: ScheduleRow } | null> {
  if (!payload.start_time || !dates.length) return null;
  const sorted = [...dates].sort();
  try {
    const rows = await api<ScheduleRow[]>(
      `/api/schedule?from=${sorted[0]}&to=${sorted[sorted.length - 1]}`,
    );
    const byDate = new Map<string, ScheduleRow[]>();
    for (const r of Array.isArray(rows) ? rows : []) {
      if (selfId && r.id === selfId) continue;
      const key = String(r.date || "").slice(0, 10);
      const bucket = byDate.get(key);
      if (bucket) bucket.push(r);
      else byDate.set(key, [r]);
    }
    for (const date of sorted) {
      const hit = (byDate.get(date) || []).find((r) => entriesClash(payload, r));
      if (hit) return { date, row: hit };
    }
    return null;
  } catch {
    // A failed read must never stop a save.
    return null;
  }
}
