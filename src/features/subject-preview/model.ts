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
// The product's own mirrors of the SQL that decides delivery. Grouping the
// sidebar with anything else would draw classes the database does not
// agree exist — "Math" and "Mathematics" as two, for one obvious example.
import { distinctClasses, normGrade, normSubject } from "@/shared/lib/classMatch";
import { KINDS, type KindKey } from "./types";
import type {
  Item, Lesson, MaterialRow, RosterClass, StudentModel, StudentSubject,
  Division, Identity, Skill, StudentWorkItem, SubjectGroup, TeacherModel,
  Unit, Waiting,
} from "./types";

/** `${subject}|${grade}` — one class. Null when there is no subject to key on. */
export function classKey(subject: unknown, grade: unknown): string | null {
  const s = normSubject(subject as string);
  if (!s) return null;
  return `${s}|${normGrade(grade as string) ?? ""}`;
}

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
    softGet<any[]>("/api/skills", []),
    softGet<any[]>("/api/skill-assignments", []),
    ...KINDS.map((k) => softGet<any[]>(`/api/${k.path}`, [])),
  ]);
  const [skills, skillAssignments] = byKind.splice(0, 2) as [any[], any[]];

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
  const ensure = (raw: unknown, grade: unknown): SubjectGroup | null => {
    const key = classKey(raw, grade);
    if (!key) return null;
    let g = groups.get(key);
    if (!g) {
      const gradeText = String(grade ?? "").trim();
      g = {
        key,
        name: String(raw).trim(),
        grade: gradeText || null,
        gradeKey: normGrade(gradeText) ?? "",
        grades: gradeText ? [gradeText] : [],
        sections: [],
        divisions: [], skills: [],
        items: Object.fromEntries(KINDS.map((k) => [k.key, [] as Item[]])) as Record<KindKey, Item[]>,
        total: 0, students: 0, lessons: [],
        weekTotal: 0, weekWithPlan: 0,
        materials: [], syllabus: null, units: [],
      };
      groups.set(key, g);
    }
    return g;
  };

  const sectionSeen = new Map<string, string[]>();
  const note = (g: SubjectGroup, section: unknown) => {
    if (!sectionSeen.has(g.key)) sectionSeen.set(g.key, []);
    sectionSeen.get(g.key)!.push(String(section ?? ""));
  };

  for (const it of all) {
    const g = ensure(it.subject, it.grade);
    if (!g) continue;
    g.items[it.kind].push(it);
    g.total += 1;
    note(g, it.section);
  }
  for (const l of lessons) {
    const g = ensure(l.subject, l.grade);
    if (!g) continue;
    g.lessons.push(l);
    g.weekTotal += 1;
    if (l.hasPlan) g.weekWithPlan += 1;
    note(g, l.section);
  }
  for (const s of asArray(students)) {
    const g = ensure(s.subject, s.grade);
    if (!g) continue;
    g.students += 1;
    note(g, s.section ?? s.division);
  }
  for (const m of mats) {
    const g = ensure(m.subject, m.grade);
    if (!g) continue;
    g.materials.push(m);
  }
  for (const u of units) {
    const g = ensure(u.subject, u.grade);
    if (!g) continue;
    g.units.push(u);
  }

  // A division is a real column (students.division), so its roll is a
  // count, not an estimate. Sections that appear only on a lesson or a
  // quiz are listed too, at zero — a class taught to 9C with nobody on
  // the roster for 9C is a delivery problem worth seeing.
  const rosterByClass = new Map<string, Map<string, number>>();
  for (const s of asArray(students)) {
    const k = classKey(s.subject, s.grade);
    if (!k) continue;
    const div = String(s.section ?? s.division ?? "").trim() || "—";
    if (!rosterByClass.has(k)) rosterByClass.set(k, new Map());
    const m = rosterByClass.get(k)!;
    m.set(div, (m.get(div) ?? 0) + 1);
  }

  for (const g of groups.values()) {
    g.sections = commonest(sectionSeen.get(g.key) ?? []);
    const counted = rosterByClass.get(g.key) ?? new Map<string, number>();
    const names = new Set<string>([...counted.keys(), ...g.sections]);
    names.delete("");
    g.divisions = [...names]
      .map((name): Division => ({ name, students: counted.get(name) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
    g.skills = skillsFor(g, asArray(skills), asArray(skillAssignments));
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

  // Grade first so the sidebar's grade groups come out in school order,
  // then the busiest class inside each — the one being taught this week
  // leads its own grade rather than the whole list.
  const subjects = [...groups.values()].sort(
    (a, b) =>
      a.gradeKey.localeCompare(b.gradeKey, undefined, { numeric: true }) ||
      b.weekTotal - a.weekTotal ||
      b.total - a.total ||
      a.name.localeCompare(b.name),
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
    rosterClasses: distinctClasses(
      asArray(students).map((s) => ({
        id: String(s.id),
        grade: s.grade ?? null,
        section: s.section ?? s.division ?? null,
        subject: s.subject ?? null,
      })),
    ) as RosterClass[],
    units,
    identity: {
      roles: asArray(me.roles).map(String),
      permissions: (me.permissions && typeof me.permissions === "object" ? me.permissions : {}) as Identity["permissions"],
    },
  };
}

/**
 * Which teaching skills ground generation for this class.
 *
 * An assignment's grade / section / subject are the scheduler's audience
 * vocabulary, where NULL means "any" — so a skill assigned with no
 * subject reaches every class, and one naming this subject and grade
 * reaches only this one. Said in words on the card, because "why is this
 * profile being used here" is otherwise unanswerable from the screen.
 */
function skillsFor(g: SubjectGroup, skills: any[], assignments: any[]): Skill[] {
  const byId = new Map(skills.map((s) => [String(s.id), s]));
  const out = new Map<string, Skill>();
  for (const a of assignments) {
    const aSubject = normSubject(a.subject);
    const aGrade = normGrade(a.grade);
    if (aSubject && aSubject !== normSubject(g.name)) continue;
    if (aGrade && aGrade !== (g.gradeKey || null)) continue;
    const skill = byId.get(String(a.skill_id));
    if (!skill) continue;
    const via = aSubject && aGrade ? "this class"
      : aSubject ? "every grade of this subject"
      : aGrade ? "every subject in this grade"
      : "everything you make";
    // The narrowest assignment wins the label — a skill reaching this
    // class both ways should read as reaching this class.
    if (out.get(String(skill.id))?.via === "this class") continue;
    out.set(String(skill.id), {
      id: String(skill.id),
      name: String(skill.name || "Untitled skill"),
      sourceType: skill.source_type ?? null,
      status: skill.status ?? null,
      via,
    });
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
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
  const [dash, subjects, me] = await Promise.all([
    softGet<any>("/api/student/dashboard", {}),
    softGet<any[]>("/api/student/subjects", []),
    softGet<any>("/api/me", {}),
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
    isStudent: me.role === "student" || asArray(me.roles).includes("student"),
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
