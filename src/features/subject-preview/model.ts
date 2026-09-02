// =====================================================================
// Everything the preview shows, read once and regrouped by subject
//
// Read-only, and deliberately so: this file calls GET and nothing else.
// It is a preview of an information architecture, not a second way to
// write to the library.
//
// The regrouping is the whole point. Nine list endpoints answer "give me
// every quiz" — the shape the shipped studio was built around — and this
// turns them into "give me Biology", which is the shape a teacher's day
// actually has. Doing it in the browser is correct at teacher scale (a
// term is a few hundred rows) and is the same assumption every list
// screen in the product already makes.
// =====================================================================

import { api } from "@/shared/lib/apiClient";
import { KINDS, type KindKey } from "./types";
import type {
  Item, Lesson, MaterialRow, StudentModel, StudentSubject, StudentWorkItem,
  SubjectGroup, TeacherModel, Unit, Waiting,
} from "./types";

const normSubject = (s: unknown) =>
  String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shiftDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "M";

/** Newest first, nulls last — the order every list on this page uses. */
const byRecent = (a: { updatedAt: string | null }, b: { updatedAt: string | null }) =>
  (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");

/** Whichever value appeared most often, so a stray typo doesn't win. */
function commonest(values: (string | null | undefined)[]): string[] {
  const n = new Map<string, number>();
  for (const v of values) {
    const t = String(v ?? "").trim();
    if (t) n.set(t, (n.get(t) ?? 0) + 1);
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/**
 * A GET that answers with [] instead of throwing.
 *
 * The preview reads nine endpoints at once and one of them being cold —
 * the shared template library lives on the separate backend, goals are
 * behind a table a young account may not have rows in — must not blank
 * the whole page. A missing shelf is an empty shelf here.
 */
const softGet = <T,>(path: string, fallback: T): Promise<T> =>
  api(path).then((d) => (d as T) ?? fallback).catch(() => fallback);

// ── the teacher ───────────────────────────────────────────────────────

export async function loadTeacher(): Promise<TeacherModel> {
  const today = shiftDays(0);
  const weekEnd = shiftDays(6);

  const [me, dash, week, students, materials, goals, ...byKind] = await Promise.all([
    softGet<any>("/api/me", {}),
    softGet<any>("/api/dashboard", {}),
    softGet<any>(`/api/week?from=${today}&to=${weekEnd}`, {}),
    softGet<any[]>("/api/students", []),
    softGet<any[]>("/api/materials", []),
    softGet<any[]>("/api/goals", []),
    ...KINDS.map((k) => softGet<any[]>(`/api/${k.path}`, [])),
  ]);

  // ── flatten every artefact into one list, tagged with its kind ──
  const all: Item[] = [];
  KINDS.forEach((def, i) => {
    for (const r of asArray(byKind[i])) {
      all.push({
        id: String(r.id),
        kind: def.key,
        title: String(r.title || r.name || "Untitled").trim() || "Untitled",
        subject: r.subject ?? null,
        grade: r.grade ?? null,
        section: r.section ?? null,
        status: r.status ?? null,
        updatedAt: r.updated_at ?? r.last_edited ?? r.created_at ?? null,
        raw: r,
      });
    }
  });
  all.sort(byRecent);

  const lessons: Lesson[] = asArray(week.lessons).map((l) => ({
    id: String(l.id),
    title: String(l.title || "Untitled lesson"),
    subject: l.subject ?? null,
    grade: l.grade ?? null,
    section: l.section ?? null,
    date: l.date,
    startTime: l.start_time ?? null,
    endTime: l.end_time ?? null,
    location: l.location ?? null,
    hasPlan: !!l.has_draft,
    draftId: l.draft_id ?? null,
    status: l.status ?? null,
  }));

  const mats: MaterialRow[] = asArray(materials).map((m) => ({
    id: String(m.id),
    title: String(m.title || m.file_name || "Untitled file"),
    fileName: m.file_name ?? null,
    kind: m.kind ?? null,
    pages: m.pages ?? null,
    subject: m.subject ?? null,
    grade: m.grade ?? null,
    updatedAt: m.updated_at ?? m.created_at ?? null,
  }));

  const units: (Unit & { subject: string | null; grade: string | null })[] =
    asArray(goals).map((g) => ({
      id: String(g.id),
      title: String(g.title || "Untitled unit"),
      status: g.status ?? null,
      days: g.timeline_days ?? null,
      startDate: g.start_date ?? null,
      // `achieved` is the only status that means the teaching is done.
      // `active` is a unit in progress, which is not the same as covered.
      covered: g.status === "achieved",
      subject: g.subject ?? null,
      grade: g.grade ?? null,
    }));

  // ── every subject that appears ANYWHERE, not only on the roster ──
  //
  // A teacher who has drafted three Biology lessons but not yet added a
  // Biology student still teaches Biology. Deriving subjects from the
  // roster alone hid exactly the work she had just done.
  const groups = new Map<string, SubjectGroup>();
  const ensure = (raw: unknown): SubjectGroup | null => {
    const key = normSubject(raw);
    if (!key) return null;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        name: String(raw).trim(),
        grades: [], sections: [],
        items: Object.fromEntries(KINDS.map((k) => [k.key, [] as Item[]])) as Record<KindKey, Item[]>,
        total: 0, students: 0, lessons: [],
        weekTotal: 0, weekWithPlan: 0,
        materials: [], syllabus: null, units: [],
      };
      groups.set(key, g);
    }
    return g;
  };

  const gradeSeen = new Map<string, string[]>();
  const sectionSeen = new Map<string, string[]>();
  const note = (g: SubjectGroup, grade: unknown, section: unknown) => {
    if (!gradeSeen.has(g.key)) gradeSeen.set(g.key, []);
    if (!sectionSeen.has(g.key)) sectionSeen.set(g.key, []);
    gradeSeen.get(g.key)!.push(String(grade ?? ""));
    sectionSeen.get(g.key)!.push(String(section ?? ""));
  };

  for (const it of all) {
    const g = ensure(it.subject);
    if (!g) continue;
    g.items[it.kind].push(it);
    g.total += 1;
    note(g, it.grade, it.section);
  }
  for (const l of lessons) {
    const g = ensure(l.subject);
    if (!g) continue;
    g.lessons.push(l);
    g.weekTotal += 1;
    if (l.hasPlan) g.weekWithPlan += 1;
    note(g, l.grade, l.section);
  }
  for (const s of asArray(students)) {
    const g = ensure(s.subject);
    if (!g) continue;
    g.students += 1;
    note(g, s.grade, s.section ?? s.division);
  }
  for (const m of mats) {
    const g = ensure(m.subject);
    if (!g) continue;
    g.materials.push(m);
    note(g, m.grade, null);
  }
  for (const u of units) {
    const g = ensure(u.subject);
    if (!g) continue;
    g.units.push(u);
    note(g, u.grade, null);
  }

  for (const g of groups.values()) {
    g.grades = commonest(gradeSeen.get(g.key) ?? []);
    g.sections = commonest(sectionSeen.get(g.key) ?? []);
    g.materials.sort(byRecent);
    // A subject is built on ONE document, and that is the one it says is
    // loaded. Prefer a file the teacher tagged as the syllabus; fall
    // back to a textbook; say nothing rather than promote a stray
    // worksheet into being the spine of the subject.
    g.syllabus =
      g.materials.find((m) => m.kind === "syllabus") ??
      g.materials.find((m) => m.kind === "textbook") ??
      null;
    for (const k of KINDS) g.items[k.key].sort(byRecent);
  }

  // Busiest first — the subject she is actually teaching this week leads.
  const subjects = [...groups.values()].sort(
    (a, b) => b.weekTotal - a.weekTotal || b.total - a.total || a.name.localeCompare(b.name),
  );

  const todayLessons = lessons
    .filter((l) => l.date === today)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

  const waiting: Waiting[] = asArray(dash.tasks)
    .filter((t) => t.kind !== "lesson")
    .slice(0, 4)
    .map((t) => ({
      id: String(t.id), title: String(t.title), meta: String(t.meta ?? ""),
      kind: String(t.kind), urgent: !!t.urgent,
    }));

  const name = String(me.full_name || me.first_name || "").trim() || "Teacher";

  return {
    name,
    initials: initialsOf(name),
    school: me.school_name ?? me.school ?? null,
    today,
    todayLessons,
    weekTotal: lessons.length,
    weekWithPlan: lessons.filter((l) => l.hasPlan).length,
    subjects,
    recent: all.slice(0, 6),
    waiting,
    all,
  };
}

// ── the student ───────────────────────────────────────────────────────

/** ai_studio.type, as the student's classroom returns it. */
const STUDENT_KIND: Record<string, KindKey> = {
  lesson_plan: "lesson_plan",
  student_notes: "student_notes",
  teaching_guide: "student_notes",
  homework: "homework",
  activity: "activity",
  quiz: "quiz",
  presentation: "presentation",
};

export async function loadStudent(): Promise<StudentModel> {
  const [dash, subjects] = await Promise.all([
    softGet<any>("/api/student/dashboard", {}),
    softGet<any[]>("/api/student/subjects", []),
  ]);

  const st = dash.student ?? {};
  const name =
    [st.first_name, st.last_name].filter(Boolean).join(" ").trim() || "Student";

  return {
    name,
    initials: initialsOf(name),
    grade: st.grade ?? null,
    section: st.section ?? null,
    school: st.school ?? null,
    subjects: asArray(subjects).map(
      (s): StudentSubject => ({
        studentRowId: String(s.student_row_id),
        subject: String(s.subject || "Untitled subject"),
        grade: s.grade ?? null,
        section: s.section ?? null,
        teacher: s.teacher?.trim() || null,
        workCount: Number(s.work_count) || 0,
        work: null,
        loading: false,
        error: null,
      }),
    ),
    attendance: dash.attendance ?? null,
    scores: asArray(dash.scores).map((s) => ({
      id: String(s.id), title: String(s.title || "Work"),
      score: s.score ?? null, maxScore: s.max_score ?? null,
      submittedAt: s.submitted_at ?? null,
    })),
    grades: asArray(dash.grades).map((g) => ({
      subject: g.subject ?? null, term: g.term ?? null, label: g.label ?? null,
      score: g.score ?? null, maxScore: g.max_score ?? null,
      recordedOn: g.recorded_on ?? null,
    })),
    noClasses: !!dash.no_classes || !asArray(subjects).length,
  };
}

/**
 * One subject's classroom, fetched when it is opened.
 *
 * Not loaded up front: student_class() is a per-roster-row RPC that
 * returns every piece of work with its submission and attempt attached,
 * so calling it for six subjects to render six counts would fetch the
 * whole term to draw a number the subjects list already carries.
 */
export async function loadStudentSubject(studentRowId: string): Promise<StudentWorkItem[]> {
  const data = await api<any>(`/api/student/class/${studentRowId}`);
  const today = shiftDays(0);
  return asArray(data?.work).map(
    (w): StudentWorkItem => ({
      entryId: String(w.entry_id),
      workId: String(w.work_id),
      kind: STUDENT_KIND[String(w.type)] ?? "other",
      title: String(w.title || "Work"),
      date: w.date ?? null,
      startTime: w.start_time ?? null,
      submitted: !!w.submitted,
      submittedAt: w.submitted_at ?? null,
      score: w.score ?? null,
      maxScore: w.max_score ?? null,
      attemptStatus: w.attempt_status ?? null,
      upcoming: !!w.date && w.date >= today,
    }),
  );
}
