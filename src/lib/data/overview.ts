import { supabase } from "@/lib/supabase/client";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export interface ChartPoint {
  label: string;
  value: number;
}

export interface UpcomingItem {
  id: string;
  title: string;
  date: string;
  status: "scheduled" | "draft";
}

export interface OverviewSnapshot {
  classCount: number;
  studentCount: number;
  pendingReview: number;
  avgAttendancePct: number | null;
  attendanceByDay: ChartPoint[];
  resultsByClass: ChartPoint[];
  termProgress: { approved: number; drafted: number };
  upcoming: UpcomingItem[];
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function getOverviewSnapshot(ownerId: string): Promise<OverviewSnapshot> {
  const db = requireClient();

  const [{ count: classCount }, { count: studentCount }, { count: pendingReview }] =
    await Promise.all([
      db.from("classes").select("*", { count: "exact", head: true }).eq("owner_id", ownerId),
      db.from("students").select("*", { count: "exact", head: true }).eq("owner_id", ownerId),
      db
        .from("goals")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .eq("status", "draft"),
    ]);

  const since = new Date();
  since.setDate(since.getDate() - 6);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data: attendanceRows } = await db
    .from("attendance")
    .select("date, status")
    .eq("owner_id", ownerId)
    .gte("date", sinceIso);

  const byDay = new Map<string, { present: number; total: number }>();
  for (const row of attendanceRows ?? []) {
    const bucket = byDay.get(row.date) ?? { present: 0, total: 0 };
    bucket.total += 1;
    if (row.status === "present") bucket.present += 1;
    byDay.set(row.date, bucket);
  }
  const attendanceByDay: ChartPoint[] = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { present, total }]) => ({
      label: WEEKDAY_LABELS[new Date(date).getDay()],
      value: total > 0 ? Math.round((present / total) * 100) : 0,
    }));
  const totalAttendance = Array.from(byDay.values()).reduce((s, d) => s + d.total, 0);
  const totalPresent = Array.from(byDay.values()).reduce((s, d) => s + d.present, 0);
  const avgAttendancePct = totalAttendance > 0 ? Math.round((totalPresent / totalAttendance) * 100) : null;

  const { data: resultRows } = await db
    .from("results")
    .select("score, assessment:assessments(class:classes(subject))")
    .eq("owner_id", ownerId);

  const bySubject = new Map<string, { sum: number; count: number }>();
  for (const row of (resultRows ?? []) as unknown as {
    score: number | null;
    assessment: { class: { subject: string } | null } | null;
  }[]) {
    const subject = row.assessment?.class?.subject;
    if (!subject || row.score === null) continue;
    const bucket = bySubject.get(subject) ?? { sum: 0, count: 0 };
    bucket.sum += row.score;
    bucket.count += 1;
    bySubject.set(subject, bucket);
  }
  const resultsByClass: ChartPoint[] = Array.from(bySubject.entries()).map(([label, { sum, count }]) => ({
    label,
    value: Math.round(sum / count),
  }));

  const { count: goalsApproved } = await db
    .from("goals")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .eq("status", "approved");

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: upcomingItems }, { data: upcomingAssessments }] = await Promise.all([
    db
      .from("goal_items")
      .select("id, title, scheduled_for")
      .eq("owner_id", ownerId)
      .not("scheduled_for", "is", null)
      .gte("scheduled_for", today)
      .order("scheduled_for", { ascending: true })
      .limit(5),
    db
      .from("assessments")
      .select("id, title, scheduled_for, status")
      .eq("owner_id", ownerId)
      .not("scheduled_for", "is", null)
      .gte("scheduled_for", today)
      .order("scheduled_for", { ascending: true })
      .limit(5),
  ]);

  const upcoming: UpcomingItem[] = [
    ...(upcomingItems ?? []).map((i) => ({
      id: i.id,
      title: i.title,
      date: i.scheduled_for as string,
      status: "scheduled" as const,
    })),
    ...(upcomingAssessments ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      date: a.scheduled_for as string,
      status: (a.status === "scheduled" ? "scheduled" : "draft") as "scheduled" | "draft",
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  return {
    classCount: classCount ?? 0,
    studentCount: studentCount ?? 0,
    pendingReview: pendingReview ?? 0,
    avgAttendancePct,
    attendanceByDay,
    resultsByClass,
    termProgress: { approved: goalsApproved ?? 0, drafted: pendingReview ?? 0 },
    upcoming,
  };
}
