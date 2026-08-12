// =====================================================================
// The rest of the teacher's data, straight from Supabase
//
// Profile, register, timetable, attendance, gradebook, notices, schools
// and uploaded material. Each function returns the shape the screens were
// already written against, so the translation lives here rather than in
// forty components.
//
// Two translations recur and are worth naming once:
//   section  ↔ students.division / schedule_entries.section
//   category ↔ student_grades.label
// Both were renamed in the schema for good reasons; neither is worth
// renaming forty call sites over.
//
// Nothing here filters by owner. RLS does that — every one of these
// tables carries an owner policy, so `select * from students` returns
// this teacher's students and nobody else's. Adding a redundant
// `.eq("faculty_id", …)` would only be a second place to get it wrong.
// The owner id IS supplied on insert, because a policy checks it rather
// than filling it in.
// =====================================================================
import { supabase } from "@/lib/supabaseClient";
import { clearIdent, facultyId, ident } from "./session";
import { daysFromToday } from "../localDate";

const iso = () => new Date().toISOString();
const notFound = () => Object.assign(new Error("Not found"), { status: 404 });

// ── profile ───────────────────────────────────────────────────────────

/** /api/me — users ⨝ faculty ⨝ subscriptions ⨝ credits, flattened. */
export async function getProfile() {
  const { userId, facultyId: fid } = await ident();
  if (!fid) throw Object.assign(new Error("Your teaching profile hasn't been set up yet."), {
    status: 404, code: "no_teacher_row",
  });

  const [u, f, s, c] = await Promise.all([
    supabase.from("users").select("*").eq("id", userId).single(),
    supabase.from("faculty").select("*").eq("id", fid).single(),
    supabase.from("subscriptions").select("plan,status,trial_ends_at,current_period_end").eq("faculty_id", fid).maybeSingle(),
    supabase.from("credits").select("balance,monthly_allowance").eq("faculty_id", fid).maybeSingle(),
  ]);
  for (const r of [u, f]) if (r.error) throw r.error;

  const user: any = u.data, fac: any = f.data, sub: any = s.data, cr: any = c.data;
  return {
    id: fac.id,
    user_id: user.id,
    faculty_code: fac.faculty_code,
    first_name: user.first_name,
    last_name: user.last_name,
    full_name:
      [user.first_name, user.last_name].filter(Boolean).join(" ") || user.full_name,
    email: user.email,
    phone: user.phone,
    avatar_url: user.avatar_url,
    role: user.role,
    onboarding_status: user.onboarding_status,
    staff_id: fac.staff_id,
    // The renames the screens do not know about.
    majors: fac.expertise || [],
    grade_levels: fac.eligible_grades || [],
    languages: fac.languages || [],
    qualification: fac.qualification || [],
    nationality: fac.nationality,
    bio: fac.bio,
    years_experience: fac.years_experience,
    hire_date: fac.hire_date,
    organization: fac.organization,
    school_id: fac.school_id,
    credits_balance: cr?.balance ?? null,
    credits_allowance: cr?.monthly_allowance ?? null,
    subscription_plan: sub?.plan ?? null,
    subscription_status: sub?.status ?? null,
    subscription_ends_at: sub?.current_period_end ?? sub?.trial_ends_at ?? null,
    created_at: fac.created_at,
    updated_at: fac.updated_at,
  };
}

const USER_FIELDS = ["first_name", "last_name", "email", "phone", "avatar_url", "locale"];
const FACULTY_MAP: Record<string, string> = {
  staff_id: "staff_id", nationality: "nationality", bio: "bio",
  hire_date: "hire_date", organization: "organization", school_id: "school_id",
  years_experience: "years_experience", qualification: "qualification",
  languages: "languages",
  majors: "expertise", grade_levels: "eligible_grades",
};

export async function updateProfile(patch: Record<string, any>) {
  const { userId, facultyId: fid } = await ident();
  if (!fid) throw notFound();

  // Never client-settable: role decides what you can see, and the
  // subscription and balance decide what you have paid for. RLS refuses
  // the latter two anyway; stripping them here means the write is not
  // silently dropped instead.
  const body = { ...patch };
  for (const k of ["role", "sub_role", "status", "subscription_plan", "subscription_status",
                   "credits_balance", "id", "user_id", "class_map", "grade_sections", "sections"]) {
    delete body[k];
  }

  const uPatch: Record<string, any> = {};
  for (const k of USER_FIELDS) if (body[k] !== undefined) uPatch[k] = body[k];
  const fPatch: Record<string, any> = {};
  for (const [from, to] of Object.entries(FACULTY_MAP)) if (body[from] !== undefined) fPatch[to] = body[from];

  if (Object.keys(uPatch).length) {
    uPatch.updated_at = iso();
    const { error } = await supabase.from("users").update(uPatch).eq("id", userId);
    if (error) throw error;
  }
  if (Object.keys(fPatch).length) {
    fPatch.updated_at = iso();
    const { error } = await supabase.from("faculty").update(fPatch).eq("id", fid);
    if (error) throw error;
  }
  return getProfile();
}

// ── students ──────────────────────────────────────────────────────────

const STUDENT_COLS =
  "id, student_code, first_name, last_name, student_id, date_of_birth, gender, grade, " +
  "division, email, phone, nationality, address, primary_guardian_name, " +
  "primary_guardian_relationship, primary_guardian_email, primary_guardian_phone, " +
  "secondary_guardian_name, secondary_guardian_relationship, secondary_guardian_email, " +
  "secondary_guardian_phone, enrollment_date, notes, school_id, user_id, created_at, updated_at";

const outStudent = (r: any) => (r ? { ...r, section: r.division } : r);
const inStudent = (b: Record<string, any>) => {
  const o = { ...b };
  if ("section" in o) { o.division = o.section; delete o.section; }
  delete o.id; delete o.created_by; delete o.student_code;
  return o;
};

export async function listStudents() {
  const { data, error } = await supabase
    .from("students").select(STUDENT_COLS)
    .order("grade").order("division").order("last_name");
  if (error) throw error;
  return (data || []).map(outStudent);
}

export async function getStudent(id: string) {
  const { data, error } = await supabase.from("students").select(STUDENT_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return outStudent(data);
}

export async function createStudent(body: Record<string, any>) {
  const fid = await facultyId();
  const { data, error } = await supabase
    .from("students").insert({ ...inStudent(body), created_by: fid })
    .select(STUDENT_COLS).single();
  if (error) throw error;
  return outStudent(data);
}

export async function updateStudent(id: string, body: Record<string, any>) {
  const { data, error } = await supabase
    .from("students").update({ ...inStudent(body), updated_at: iso() })
    .eq("id", id).select(STUDENT_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return outStudent(data);
}

export async function deleteStudent(id: string) {
  const fid = await facultyId();
  // Only the creator may delete. Seeing a student through a shared class
  // is not the same as being able to erase them from the school's
  // records — the policy allows the update, so the intent is enforced here.
  const { error, count } = await supabase
    .from("students").delete({ count: "exact" }).eq("id", id).eq("created_by", fid);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── schedule ──────────────────────────────────────────────────────────

const SCHED = "id, draft_id, class_id, title, subject, grade, section, date, start_time, end_time, location, notes, status, created_at, updated_at";

export async function listSchedule(params: URLSearchParams) {
  let q = supabase.from("schedule_entries").select(SCHED).order("date").order("start_time");
  const from = params.get("from"), to = params.get("to");
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createSchedule(body: Record<string, any>) {
  const fid = await facultyId();
  const { data, error } = await supabase
    .from("schedule_entries").insert({ ...body, faculty_id: fid }).select(SCHED).single();
  if (error) throw error;
  return data;
}

export async function updateSchedule(id: string, body: Record<string, any>) {
  const { data, error } = await supabase
    .from("schedule_entries").update({ ...body, updated_at: iso() })
    .eq("id", id).select(SCHED).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function deleteSchedule(id: string) {
  const { error, count } = await supabase.from("schedule_entries").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── attendance ────────────────────────────────────────────────────────

export async function listAttendance(params: URLSearchParams) {
  const studentId = params.get("student_id");
  if (studentId) {
    const { data, error } = await supabase
      .from("attendance").select("id, date, status, note, class_id, schedule_id")
      .eq("student_id", studentId).order("date", { ascending: false }).limit(200);
    if (error) throw error;
    return (data || []).map((r: any) => ({ ...r, notes: r.note }));
  }

  const date = params.get("date");
  if (!date) throw Object.assign(new Error("date or student_id is required"), { status: 400 });

  // The register lists EVERY student, marked or not — so it is the
  // roster that drives it, with marks joined on. Two queries rather than
  // an embedded join, because PostgREST cannot express "left join on a
  // second condition (this date)" in one.
  const [roster, marks] = await Promise.all([
    listStudents(),
    supabase.from("attendance").select("id, student_id, status, note").eq("date", date),
  ]);
  if (marks.error) throw marks.error;
  const byStudent = new Map((marks.data || []).map((m: any) => [m.student_id, m]));

  const grade = params.get("grade"), section = params.get("section");
  return roster
    .filter((s: any) => (!grade || s.grade === grade) && (!section || s.section === section))
    .map((s: any) => {
      const m: any = byStudent.get(s.id);
      return {
        student_id: s.id, first_name: s.first_name, last_name: s.last_name,
        code: s.student_id, grade: s.grade, section: s.section,
        attendance_id: m?.id ?? null, status: m?.status ?? null, notes: m?.note ?? null,
      };
    });
}

export async function markAttendance(studentId: string, body: Record<string, any>) {
  const fid = await facultyId();
  const { date, status, notes, class_id, schedule_id } = body || {};
  if (!date) throw Object.assign(new Error("date is required"), { status: 400 });
  if (!status) throw Object.assign(new Error("status is required"), { status: 400 });

  // Taking the register twice must correct it, not double it. The key is
  // (student, date, schedule_key) where schedule_key is a generated
  // column folding "no session" into a fixed uuid — one ordinary
  // constraint covering both cases, which is what onConflict can name.
  // Partial indexes could not be targeted this way.
  const row = {
    faculty_id: fid, student_id: studentId, date, status,
    note: notes ?? null, class_id: class_id ?? null, schedule_id: schedule_id ?? null,
  };
  const { data, error } = await supabase
    .from("attendance")
    .upsert(row, { onConflict: "student_id,date,schedule_key", ignoreDuplicates: false })
    .select("id, student_id, date, status, note, class_id, schedule_id").single();
  if (error) throw error;
  return { ...data, notes: (data as any).note };
}

// ── gradebook ─────────────────────────────────────────────────────────

const GRADE_COLS = "id, student_id, class_id, source_id, subject, term, label, score, max_score, recorded_on";
const outGrade = (r: any) => (r ? { ...r, category: r.label, recorded_at: r.recorded_on } : r);
const inGrade = (b: Record<string, any>) => {
  const o = { ...b };
  if ("category" in o) { o.label = o.category; delete o.category; }
  delete o.recorded_at; delete o.id;
  return o;
};

export async function listGrades(params: URLSearchParams) {
  let q = supabase.from("student_grades").select(GRADE_COLS).order("recorded_on", { ascending: false });
  for (const k of ["student_id", "subject", "term"]) {
    const v = params.get(k);
    if (v) q = q.eq(k, v);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(outGrade);
}

export async function createGrade(body: Record<string, any>) {
  const fid = await facultyId();
  const { data, error } = await supabase
    .from("student_grades").insert({ ...inGrade(body), faculty_id: fid })
    .select(GRADE_COLS).single();
  if (error) throw error;
  return outGrade(data);
}

export async function updateGrade(id: string, body: Record<string, any>) {
  const { data, error } = await supabase
    .from("student_grades").update({ ...inGrade(body), updated_at: iso() })
    .eq("id", id).select(GRADE_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return outGrade(data);
}

export async function deleteGrade(id: string) {
  const { error, count } = await supabase.from("student_grades").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

/**
 * Per-student averages across BOTH typed-in marks and work the studio
 * scored. A teacher's sense of how a student is doing does not
 * distinguish between the two, so neither does this.
 */
export async function gradeSummary() {
  const [roster, typed, scored] = await Promise.all([
    listStudents(),
    supabase.from("student_grades").select("student_id, score, max_score"),
    supabase.from("quiz_attempts").select("student_id, score, max_score"),
  ]);
  if (typed.error) throw typed.error;
  if (scored.error) throw scored.error;

  const acc = new Map<string, { n: number; sum: number }>();
  for (const r of [...(typed.data || []), ...(scored.data || [])] as any[]) {
    if (r.score == null || !r.max_score) continue;
    const cur = acc.get(r.student_id) || { n: 0, sum: 0 };
    cur.n += 1;
    cur.sum += (Number(r.score) / Number(r.max_score)) * 100;
    acc.set(r.student_id, cur);
  }
  return roster.map((s: any) => {
    const a = acc.get(s.id);
    return {
      student_id: s.id, first_name: s.first_name, last_name: s.last_name,
      grade: s.grade, section: s.section,
      entries: a?.n ?? 0,
      average_pct: a && a.n ? Number((a.sum / a.n).toFixed(1)) : 0,
    };
  });
}

// ── notifications ─────────────────────────────────────────────────────

const outNote = (r: any) => ({ ...r, message: r.body, is_read: r.read_at != null });

export async function listNotifications(params: URLSearchParams) {
  let q = supabase
    .from("notifications")
    .select("id, kind, title, body, link, ref_table, ref_id, read_at, created_at")
    .order("created_at", { ascending: false }).limit(50);
  if (params.get("unread") === "true") q = q.is("read_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(outNote);
}

export async function markNotificationsRead(ids?: string[]) {
  const { userId } = await ident();
  let q = supabase.from("notifications")
    .update({ read_at: iso(), updated_at: iso() })
    .eq("user_id", userId).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) throw error;
  return { ok: true };
}

export async function deleteNotification(id: string) {
  const { error, count } = await supabase.from("notifications").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── schools ───────────────────────────────────────────────────────────

const SCHOOL_COLS = "id, name, name_ar, emirate, city, type, curriculum, website";

export async function listSchools(params: URLSearchParams) {
  let q = supabase.from("schools").select(SCHOOL_COLS).order("emirate").order("name");
  const em = params.get("emirate");
  if (em) q = q.eq("emirate", em);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createSchool(body: Record<string, any>) {
  const { name, emirate } = body || {};
  if (!name || !emirate) throw Object.assign(new Error("name and emirate are required"), { status: 400 });
  // Return the existing row rather than a duplicate — the "my school
  // isn't listed" fallback is used by many teachers at the same school.
  const { data: existing } = await supabase
    .from("schools").select(SCHOOL_COLS).ilike("name", name).eq("emirate", emirate).maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase.from("schools").insert(body).select(SCHOOL_COLS).single();
  if (error) throw error;
  return data;
}

export async function listMySchools() {
  const { data, error } = await supabase
    .from("faculty_schools")
    .select(`is_primary, grade_sections, school:schools(${SCHOOL_COLS})`)
    .order("is_primary", { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({ ...r.school, is_primary: r.is_primary, grade_sections: r.grade_sections }));
}

export async function attachSchool(body: Record<string, any>) {
  const fid = await facultyId();
  const { school_id, is_primary } = body || {};
  if (!school_id) throw Object.assign(new Error("school_id is required"), { status: 400 });
  if (is_primary) await clearPrimary(fid);
  const { error } = await supabase
    .from("faculty_schools")
    .upsert({ faculty_id: fid, school_id, is_primary: !!is_primary }, { onConflict: "faculty_id,school_id" });
  if (error) throw error;
  return listMySchools();
}

export async function updateMySchool(schoolId: string, body: Record<string, any>) {
  const fid = await facultyId();
  // At most one primary, and the unique index enforces it — so the old
  // one has to be cleared first or the update fails on the constraint
  // rather than moving the flag.
  if (body?.is_primary) await clearPrimary(fid);
  const { error } = await supabase
    .from("faculty_schools").update(body).eq("faculty_id", fid).eq("school_id", schoolId);
  if (error) throw error;
  return listMySchools();
}

export async function detachSchool(schoolId: string) {
  const fid = await facultyId();
  const { error } = await supabase
    .from("faculty_schools").delete().eq("faculty_id", fid).eq("school_id", schoolId);
  if (error) throw error;
  return { ok: true };
}

async function clearPrimary(fid: string) {
  await supabase.from("faculty_schools").update({ is_primary: false })
    .eq("faculty_id", fid).eq("is_primary", true);
}

// ── library (uploaded material) ───────────────────────────────────────

const MAT = "id, file_name, file_path, mime_type, status, extracted_text, created_at, updated_at";

export async function listLibrary() {
  const { data, error } = await supabase
    .from("materials").select(MAT).is("deleted_at", null).order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createLibrary(body: Record<string, any>) {
  const fid = await facultyId();
  const { data, error } = await supabase
    .from("materials").insert({ ...body, faculty_id: fid }).select(MAT).single();
  if (error) throw error;
  return data;
}

export async function updateLibrary(id: string, body: Record<string, any>) {
  const { data, error } = await supabase
    .from("materials").update({ ...body, updated_at: iso() }).eq("id", id).select(MAT).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function deleteLibrary(id: string) {
  const { error, count } = await supabase
    .from("materials").update({ deleted_at: iso() }, { count: "exact" }).eq("id", id).is("deleted_at", null);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── dashboard ─────────────────────────────────────────────────────────

export async function dashboard() {
  const today = daysFromToday(0);
  const weekOut = daysFromToday(7);
  const { facultyId: fid } = await ident();

  // Six round trips became four. `head: true` counts without shipping
  // rows, and one scan of ai_studio serves both the counts and the
  // recent list — a second query for five rows it already had was the
  // easiest thing here to stop doing.
  const [schedule, work, notes, roster] = await Promise.all([
    supabase.from("schedule_entries").select(SCHED)
      .gte("date", today).lte("date", weekOut).order("date").order("start_time"),
    supabase.from("ai_studio").select("id, type, status, content, updated_at")
      .is("deleted_at", null).order("updated_at", { ascending: false }),
    supabase.from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .is("read_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.from("students").select("id", { count: "exact", head: true }),
  ]);
  for (const r of [schedule, work, notes]) if (r.error) throw r.error;

  const days = (schedule.data || []) as any[];
  const rows = (work.data || []) as any[];
  const countOf = (t: string) => rows.filter((r) => r.type === t).length;

  return {
    today_lessons: days.filter((d) => d.date === today),
    upcoming_lessons: days.filter((d) => d.date > today).slice(0, 8),
    recent_drafts: rows.slice(0, 6).map((r) => ({
      id: r.id,
      name: r.content?.title || r.content?.name || "Untitled",
      type: r.type,
      status: r.status,
      subject: r.content?.subject ?? null,
      grade: r.content?.grade ?? null,
      progress: r.content?.progress ?? null,
      last_edited: r.updated_at,
    })),
    counts: {
      students: roster.count ?? 0,
      drafts: countOf("lesson_plan"),
      quizzes: countOf("quiz"),
      homework: countOf("homework"),
      presentations: countOf("presentation"),
      activities: countOf("activity"),
      templates: countOf("template"),
      total: rows.length,
    },
    recent_notifications: (notes.data || []).map(outNote),

    // ── what the charts and the calendar need ──────────────────────
    //
    // Derived from rows already fetched. A chart is not worth a second
    // round trip when the data for it is sitting in `rows`.
    activity: activitySeries(rows, 8),
    by_type: [
      { key: "lesson_plan",  label: "Lessons",       n: countOf("lesson_plan") },
      { key: "quiz",         label: "Quizzes",       n: countOf("quiz") },
      { key: "homework",     label: "Homework",      n: countOf("homework") },
      { key: "presentation", label: "Presentations", n: countOf("presentation") },
      { key: "activity",     label: "Activities",    n: countOf("activity") },
    ],
    // Every dated thing in the next fortnight, for the mini-calendar.
    calendar: days.map((d: any) => ({
      date: d.date, title: d.title, subject: d.subject,
      start_time: d.start_time, kind: "lesson",
    })),
    tasks: buildTasks(days, rows, today),
    // Trial and balance, so the dashboard can say how much runway is
    // left instead of the teacher discovering it at the moment a write
    // is refused.
    plan: await planSummary(fid),
  };
}

/**
 * Work created per week, oldest first. Eight buckets is two months —
 * enough to show a shape without pretending a new account has a trend.
 */
function activitySeries(rows: any[], weeks: number) {
  const out: { week: string; n: number }[] = [];
  const now = new Date();
  // Monday-based buckets, because a teaching week is not a calendar week
  // starting on Sunday.
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  for (let i = weeks - 1; i >= 0; i--) {
    const from = new Date(monday.getTime() - i * 7 * 864e5);
    const to = new Date(from.getTime() + 7 * 864e5);
    out.push({
      week: from.toISOString().slice(0, 10),
      n: rows.filter((r) => {
        const t = new Date(r.created_at ?? r.updated_at).getTime();
        return t >= from.getTime() && t < to.getTime();
      }).length,
    });
  }
  return out;
}

/**
 * What needs attention — derived, not typed in.
 *
 * A manual to-do list is another thing to maintain, and an empty one is
 * just a reproach. These come from work that is already in an unfinished
 * state, so the list is right without anyone tending it and empties
 * itself as the work gets done.
 */
function buildTasks(days: any[], rows: any[], today: string) {
  const tasks: any[] = [];

  for (const d of days.filter((x) => x.date === today && x.status === "planned")) {
    tasks.push({
      id: `lesson-${d.id}`, kind: "lesson",
      title: `Teach ${d.title}`,
      meta: d.start_time ? d.start_time.slice(0, 5) : "today",
      section: "schedule", urgent: true,
    });
  }

  for (const r of rows.filter((x) => x.status === "generating" || x.status === "processing")) {
    tasks.push({
      id: `stuck-${r.id}`, kind: "stuck",
      title: `Finish "${r.content?.title || r.content?.name || "Untitled"}"`,
      meta: "still drafting", section: sectionFor(r.type), urgent: true,
    });
  }

  for (const r of rows.filter((x) => {
    const p = Number(x.content?.progress);
    return Number.isFinite(p) && p > 0 && p < 100;
  }).slice(0, 4)) {
    tasks.push({
      id: `wip-${r.id}`, kind: "wip",
      title: r.content?.title || r.content?.name || "Untitled",
      meta: `${r.content.progress}% done`, section: sectionFor(r.type), urgent: false,
    });
  }

  const empty = rows.filter((x) => x.type === "quiz" && !(x.content?.questions?.length));
  for (const r of empty.slice(0, 3)) {
    tasks.push({
      id: `q-${r.id}`, kind: "empty",
      title: `Add questions to "${r.content?.title || "Untitled quiz"}"`,
      meta: "no questions yet", section: "quizzes", urgent: false,
    });
  }

  return tasks.slice(0, 8);
}

const sectionFor = (type: string) =>
  ({ lesson_plan: "lesson-plans", quiz: "quizzes", homework: "homework",
     presentation: "presentations", activity: "activities" }[type] || "lesson-plans");

/**
 * Whole days from today until `iso`, counted in CALENDAR days in the
 * reader's own timezone.
 *
 * Not `ceil(ms / 864e5)`. That counts 24-hour blocks from the current
 * instant, so the same subscription reads 20 in the morning and 19 that
 * evening — the number moves when the clock passes an arbitrary time of
 * day rather than when the date changes. Flattening both ends to local
 * midnight means it falls by exactly one, exactly at midnight.
 */
function daysUntil(iso: string): number {
  const midnight = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  return Math.max(0, Math.round((midnight(new Date(iso)) - midnight(new Date())) / 864e5));
}

/** Plan, status and days remaining. Null when there is no faculty row. */
async function planSummary(fid: string | null) {
  if (!fid) return null;
  const [sub, cr] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, status, trial_ends_at, current_period_start, current_period_end")
      .maybeSingle(),
    supabase.from("credits").select("balance, monthly_allowance").maybeSingle(),
  ]);
  const s: any = sub.data;
  if (!s) return null;
  const ends = s.current_period_end ?? s.trial_ends_at;
  return {
    plan: s.plan,
    status: s.status,
    ends_at: ends,
    started_at: s.current_period_start ?? null,
    days_left: ends ? daysUntil(ends) : null,
    credits: cr.data?.balance ?? null,
    allowance: cr.data?.monthly_allowance ?? null,
  };
}

// ── submission grids ──────────────────────────────────────────────────
//
// Homework submissions, activity completions and quiz scores are one
// question — "who has done this, and how did they do" — answered by
// three tables: assignments (who it was set to), class_members (who is
// in those classes) and quiz_attempts (what came back).
//
// PostgREST cannot express "left join attempts on assignment AND
// student" in one request, so this is four small queries composed in
// code. Four round trips to answer one screen is worth it against the
// alternative of a database view per screen.

/** Every student the work was assigned to, with their attempt if any. */
export async function submissionGrid(artifactId: string) {
  const { data: asg, error: e1 } = await supabase
    .from("assignments").select("id, class_id").eq("generation_id", artifactId);
  if (e1) throw e1;
  if (!asg?.length) return [];

  const classIds = asg.map((a: any) => a.class_id).filter(Boolean);
  const asgIds = asg.map((a: any) => a.id);

  const [members, attempts, classes] = await Promise.all([
    supabase.from("class_members").select("class_id, student_id").in("class_id", classIds),
    supabase.from("quiz_attempts")
      .select("id, assignment_id, student_id, status, started_at, submitted_at, score, max_score, feedback, answers")
      .in("assignment_id", asgIds),
    supabase.from("classes").select("id, name").in("id", classIds),
  ]);
  for (const r of [members, attempts, classes]) if (r.error) throw r.error;

  const studentIds = [...new Set((members.data || []).map((m: any) => m.student_id))];
  if (!studentIds.length) return [];
  const { data: students, error: e2 } = await supabase
    .from("students").select("id, student_code, first_name, last_name, grade, division")
    .in("id", studentIds);
  if (e2) throw e2;

  const className = new Map((classes.data || []).map((c: any) => [c.id, c.name]));
  const classOf = new Map((members.data || []).map((m: any) => [m.student_id, m.class_id]));
  const attemptOf = new Map((attempts.data || []).map((a: any) => [a.student_id, a]));

  return (students || [])
    .map((s: any) => {
      const at: any = attemptOf.get(s.id) || {};
      const cid = classOf.get(s.id);
      return {
        student_id: s.id, code: s.student_code,
        first_name: s.first_name, last_name: s.last_name,
        name: [s.first_name, s.last_name].filter(Boolean).join(" "),
        grade: s.grade, section: s.division,
        class_id: cid ?? null, class_name: cid ? className.get(cid) ?? null : null,
        status: at.status ?? null, started_at: at.started_at ?? null,
        submitted_at: at.submitted_at ?? null,
        score: at.score ?? null, max_score: at.max_score ?? null,
        feedback: at.feedback ?? null, answers: at.answers ?? null,
      };
    })
    .sort((a, b) =>
      (a.grade || "").localeCompare(b.grade || "") ||
      (a.section || "").localeCompare(b.section || "") ||
      (a.last_name || "").localeCompare(b.last_name || ""));
}

/** Record or correct one student's attempt at a piece of assigned work. */
export async function recordAttempt(artifactId: string, studentId: string, body: Record<string, any>) {
  // The assignment this student is actually on. This is the
  // authorisation as well as the lookup: a student on none of this
  // artifact's assignments produces no row, and the write stops rather
  // than creating an orphan attempt.
  const { data: asg, error } = await supabase
    .from("assignments").select("id, class_id").eq("generation_id", artifactId);
  if (error) throw error;
  if (!asg?.length) throw Object.assign(new Error("That work hasn't been assigned to a class yet."), { status: 404 });

  const { data: member, error: e2 } = await supabase
    .from("class_members").select("class_id")
    .eq("student_id", studentId)
    .in("class_id", asg.map((a: any) => a.class_id).filter(Boolean))
    .maybeSingle();
  if (e2) throw e2;
  if (!member) throw Object.assign(new Error("That student isn't assigned this work."), { status: 404 });

  const assignmentId = asg.find((a: any) => a.class_id === member.class_id)!.id;
  const row: Record<string, any> = { assignment_id: assignmentId, student_id: studentId };
  for (const k of ["status", "submitted_at", "score", "max_score", "feedback", "answers"]) {
    if (body?.[k] !== undefined) row[k] = body[k];
  }
  const { data, error: e3 } = await supabase
    .from("quiz_attempts")
    .upsert(row, { onConflict: "assignment_id,student_id", ignoreDuplicates: false })
    .select("*").single();
  if (e3) throw e3;
  return data;
}

/** /api/quiz-scores — the same attempts, keyed by quiz rather than by grid. */
export async function listQuizScores(params: URLSearchParams) {
  let q = supabase
    .from("quiz_attempts")
    .select("id, student_id, score, max_score, feedback, submitted_at, assignment:assignments!inner(id, generation_id)")
    .order("submitted_at", { ascending: false });
  const quizId = params.get("quiz_id");
  const studentId = params.get("student_id");
  if (quizId) q = q.eq("assignment.generation_id", quizId);
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r: any) => ({
    id: r.id, quiz_id: r.assignment?.generation_id ?? null, student_id: r.student_id,
    score: r.score, max_score: r.max_score, feedback: r.feedback, recorded_at: r.submitted_at,
  }));
}

export async function deleteQuizScore(id: string) {
  const { error, count } = await supabase.from("quiz_attempts").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── goals ─────────────────────────────────────────────────────────────
//
// A goal is a whole portion of a subject — a term, a unit, a book —
// that the AI breaks into a week-by-week teaching plan grounded in the
// teacher's own profile. The row is created here, browser-side; the
// PLANNING runs on the API service, because it needs the model key.
//
// plan (jsonb) belongs to the AI. The one exception is `brief`, written
// at creation: the teacher's own description of what the goal covers is
// input the planner needs, and the table has no other column for it.

const GOAL_COLS = "id, title, material_ids, timeline_days, plan, ai_verdict, status, created_at, updated_at";

export async function listGoals() {
  const { data, error } = await supabase
    .from("goals").select(GOAL_COLS).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createGoal(body: Record<string, any>) {
  const fid = await facultyId();
  const { title, brief, timeline_days, material_ids } = body || {};
  if (!title?.trim()) throw Object.assign(new Error("Give the goal a name."), { status: 400 });
  const { data, error } = await supabase
    .from("goals")
    .insert({
      faculty_id: fid,
      title: title.trim(),
      timeline_days: timeline_days ?? null,
      material_ids: material_ids?.length ? material_ids : null,
      plan: brief?.trim() ? { brief: brief.trim() } : null,
      status: "processing",
    })
    .select(GOAL_COLS).single();
  if (error) throw error;
  return data;
}

export async function updateGoal(id: string, body: Record<string, any>) {
  const patch: Record<string, any> = { updated_at: iso() };
  // Only what a teacher may change by hand. The plan and the verdict are
  // the AI's to write, through the service.
  for (const k of ["title", "timeline_days", "status"]) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabase
    .from("goals").update(patch).eq("id", id).select(GOAL_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function deleteGoal(id: string) {
  const { error, count } = await supabase.from("goals").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── teaching skills ──────────────────────────────────────────────────
//
// How this teacher teaches, as prose. skill_profile is a Markdown
// document — compiled from the skills interview, or extracted from a CV
// — and it is what the AI service reads to ground generation in this
// teacher's own practice. The rows are plain teacher-owned data, so they
// live browser→Supabase like everything else that needs no secret.

const SKILL_COLS = "id, name, source_type, skill_profile, status, created_at, updated_at";

export async function listSkills() {
  const { data, error } = await supabase
    .from("teaching_skills").select(SKILL_COLS).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createSkill(body: Record<string, any>) {
  const fid = await facultyId();
  const { name, source_type, skill_profile } = body || {};
  if (!skill_profile?.trim()) {
    throw Object.assign(new Error("The profile is empty — nothing to save."), { status: 400 });
  }
  const { data, error } = await supabase
    .from("teaching_skills")
    .insert({
      faculty_id: fid,
      name: name?.trim() || "Teaching profile",
      source_type: source_type || "interview",
      skill_profile: skill_profile.trim(),
      status: "ready",
    })
    .select(SKILL_COLS).single();
  if (error) throw error;
  return data;
}

export async function updateSkill(id: string, body: Record<string, any>) {
  const patch: Record<string, any> = { updated_at: iso() };
  for (const k of ["name", "skill_profile", "status"]) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabase
    .from("teaching_skills").update(patch).eq("id", id).select(SKILL_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function deleteSkill(id: string) {
  const { error, count } = await supabase
    .from("teaching_skills").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// Where each skill applies: grade/section/subject combos (NULL = any),
// the same audience vocabulary as the scheduler. One skill may cover
// several classes; one class may draw on several skills. The generator
// reads these rows server-side to pick which profiles ground a request.

const SKILL_ASSIGNMENT_COLS = "id, skill_id, grade, section, subject, created_at";

export async function listSkillAssignments() {
  const { data, error } = await supabase
    .from("skill_assignments")
    .select(SKILL_ASSIGNMENT_COLS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createSkillAssignment(body: Record<string, any>) {
  const fid = await facultyId();
  const { skill_id, grade, section, subject } = body || {};
  if (!skill_id) throw Object.assign(new Error("skill_id is required"), { status: 400 });
  const { data, error } = await supabase
    .from("skill_assignments")
    .insert({
      faculty_id: fid,
      skill_id,
      grade: grade || null,
      section: section || null,
      subject: subject?.trim() || null,
    })
    .select(SKILL_ASSIGNMENT_COLS)
    .single();
  if (error) {
    // The unique index refuses an exact repeat — say so in words.
    if ((error as any).code === "23505") {
      throw Object.assign(new Error("This skill already covers that exact combination."), { status: 409 });
    }
    throw error;
  }
  return data;
}

export async function deleteSkillAssignment(id: string) {
  const { error, count } = await supabase
    .from("skill_assignments").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

// ── bulletin board ────────────────────────────────────────────────────
//
// Notices a teacher pins up: field trips, exam weeks, birthdays. Plain
// rows, not artifacts — see the note on section 19b of db/tune.sql.
// Audience is grade + section text (null = the whole board), the same
// vocabulary schedule_entries uses.

const BULLETIN_COLS =
  "id, title, body, kind, status, pinned, grade, section, event_on, expires_on, media, created_at, updated_at";

export async function listBulletin(q: URLSearchParams) {
  let query = supabase
    .from("bulletin_posts")
    .select(BULLETIN_COLS)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  const status = q.get("status");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createBulletin(body: Record<string, any>) {
  const fid = await facultyId();
  const { title, kind, grade, section, event_on, expires_on, pinned } = body || {};
  if (!title?.trim()) throw Object.assign(new Error("Give the post a title."), { status: 400 });
  const { data, error } = await supabase
    .from("bulletin_posts")
    .insert({
      faculty_id: fid,
      title: title.trim(),
      body: body?.body?.trim() || null,
      kind: kind || "notice",
      pinned: !!pinned,
      grade: grade || null,
      section: section || null,
      event_on: event_on || null,
      expires_on: expires_on || null,
      media: Array.isArray(body?.media) ? body.media : [],
    })
    .select(BULLETIN_COLS).single();
  if (error) throw error;
  return data;
}

export async function updateBulletin(id: string, body: Record<string, any>) {
  const patch: Record<string, any> = { updated_at: iso() };
  for (const k of ["title", "body", "kind", "status", "pinned", "grade", "section", "event_on", "expires_on", "media"]) {
    if (body?.[k] !== undefined) patch[k] = body[k];
  }
  const { data, error } = await supabase
    .from("bulletin_posts").update(patch).eq("id", id)
    .select(BULLETIN_COLS).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound();
  return data;
}

export async function deleteBulletin(id: string) {
  const { error, count } = await supabase
    .from("bulletin_posts").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw notFound();
  return { ok: true };
}

/**
 * The class share link, minted on first ask. One row per teacher; the
 * token goes into the /board/<token> URL the students bookmark, and the
 * board behind it is served by the bulletin_board_public() function —
 * see db/tune.sql §19b².
 */
export async function getBulletinShare() {
  const fid = await facultyId();
  const { data, error } = await supabase
    .from("bulletin_shares").select("token").eq("faculty_id", fid).maybeSingle();
  if (error) throw error;
  if (data) return { token: data.token };
  const { data: created, error: insErr } = await supabase
    .from("bulletin_shares").insert({ faculty_id: fid }).select("token").single();
  if (insErr) {
    // Two tabs racing to mint the first token: the loser's insert hits
    // the primary key, but the row now exists — read it instead.
    const { data: again } = await supabase
      .from("bulletin_shares").select("token").eq("faculty_id", fid).maybeSingle();
    if (again) return { token: again.token };
    throw insErr;
  }
  return { token: created.token };
}

// ── sign-in ───────────────────────────────────────────────────────────

/**
 * Make sure the signed-in user is set up as a teacher, and claim this
 * device.
 *
 * All the browser creates is the `faculty` row. The credits balance and
 * the trial subscription follow from a database trigger
 * (`provision_faculty`), because those are entitlements — a teacher who
 * could write them could grant themselves a plan.
 *
 * Replaces POST /api/auth/supabase. There is no plan argument any more:
 * everyone starts on the same trial, and moving to a paid one is a
 * payment rather than a field on a form.
 */
export async function provisionTeacher() {
  const { userId } = await ident();

  // The auth trigger normally mirrors this, but it swallows its own
  // errors by design, so a missing row is possible and cheap to fix.
  const { data: auth } = await supabase.auth.getUser();
  const meta: any = auth?.user?.user_metadata || {};
  await supabase.from("users").upsert(
    {
      id: userId,
      email: auth?.user?.email ?? null,
      full_name: meta.full_name ?? meta.name ?? null,
      first_name: meta.given_name ?? null,
      last_name: meta.family_name ?? null,
      avatar_url: meta.avatar_url ?? meta.picture ?? null,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  const { error } = await supabase
    .from("faculty")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw error;

  clearIdent();                       // the faculty id has just changed
  const { claimDevice } = await import("./device");
  const active_session_id = await claimDevice();
  return { ...(await getProfile()), active_session_id };
}

/**
 * Take over as the active device, for a teacher who already exists.
 *
 * Replaces POST /api/auth/claim-session, including its role as the
 * "does this account exist yet" probe: getProfile throws 404
 * `no_teacher_row` when there is no faculty row, which is what sends a
 * new user down the sign-up funnel.
 */
export async function claimSession() {
  const profile = await getProfile();
  const { claimDevice } = await import("./device");
  return { ...profile, active_session_id: await claimDevice() };
}
