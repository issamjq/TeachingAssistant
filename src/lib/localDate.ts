// =====================================================================
// A calendar day, in the reader's own timezone
//
// `new Date().toISOString().slice(0, 10)` is the obvious way to get a
// YYYY-MM-DD and it is wrong everywhere east of Greenwich. It converts
// to UTC first, so local midnight — which is what a Date built from a
// calendar day actually holds — renders as the PREVIOUS day. In the UAE
// (+4) that is every date between midnight and 04:00, and for a Date
// pinned to midnight it is every date, full stop.
//
// It cost the schedule's week grid an entire column: each day looked up
// the day before it, so Monday's lessons appeared under Tuesday.
//
// The DATE columns this compares against — schedule_entries.date,
// attendance.date, student_grades.recorded_on — carry no timezone. They
// mean the day the teacher was standing in front of the class. So the
// day has to be read the same way: from the local parts.
// =====================================================================

/** YYYY-MM-DD for a Date, read in local time. */
export function isoDay(d: Date | string | number = new Date()): string {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Today, and the day `n` days from it. Negative goes backwards. */
export const today = () => isoDay(new Date());
export function daysFromToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDay(d);
}
