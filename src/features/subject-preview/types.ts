// =====================================================================
// The preview's vocabulary: a subject is the container, everything else
// hangs off it
//
// The shipped studio files work by KIND — every lesson plan in one
// library, every quiz in another — and asks the teacher to remember
// which class each one was for. This preview inverts that: the subject
// comes first, and the six things she makes are what a subject CONTAINS.
//
// Nothing here invents a new artefact. The six kinds below are the
// existing `ai_studio.type` values the studio already writes, wearing
// the reference design's labels. `materials` (her own uploads) is not a
// seventh kind — it is the shelf a subject is built ON, which is why it
// appears as the syllabus banner rather than as a make-one card.
// =====================================================================

/** The six things a teacher makes, all of them already real types. */
export type KindKey =
  | "lesson_plan" | "student_notes" | "homework"
  | "activity" | "quiz" | "presentation";

export type KindDef = {
  key: KindKey;
  /** Route segment api() answers on — /api/drafts, /api/quizzes, … */
  path: string;
  /** Plural, as a nav item and a section heading. */
  label: string;
  /** Singular, for "Make a new …". */
  one: string;
  /** What it is, in the teacher's words. Shown on the make-one cards. */
  blurb: string;
  /** Where the shipped studio keeps this kind, for the "open the real one" links. */
  route: string;
};

// Order is deliberate and matches the reference: what you plan with,
// then what students read, then what they do, then what you assess with,
// then what you present from.
export const KINDS: KindDef[] = [
  {
    key: "lesson_plan", path: "drafts", label: "Lesson plans", one: "lesson plan",
    blurb: "A step-by-step plan for one class period.", route: "/lesson-plans",
  },
  {
    key: "student_notes", path: "student-notes", label: "Study notes", one: "set of notes",
    blurb: "Simple notes students can read at home.", route: "/lesson-plans",
  },
  {
    key: "homework", path: "homework", label: "Homework", one: "homework set",
    blurb: "Practice to take away and hand back.", route: "/homework",
  },
  {
    key: "activity", path: "activities", label: "Activities", one: "activity",
    blurb: "Group work, games and hands-on tasks.", route: "/activities",
  },
  {
    key: "quiz", path: "quizzes", label: "Quizzes", one: "quiz",
    blurb: "Questions with an answer key, ready to print.", route: "/quizzes",
  },
  {
    key: "presentation", path: "presentations", label: "Presentations", one: "deck",
    blurb: "Slides to run the lesson from.", route: "/presentations",
  },
];

export const KIND_BY_KEY: Record<KindKey, KindDef> =
  Object.fromEntries(KINDS.map((k) => [k.key, k])) as Record<KindKey, KindDef>;

export type Item = {
  id: string;
  kind: KindKey;
  title: string;
  subject: string | null;
  grade: string | null;
  section: string | null;
  /** ai_studio.status — queued | generating | complete | failed | canceled. */
  status: string | null;
  updatedAt: string | null;
  /** The flattened row, so a detail view can read the body without refetching. */
  raw: Record<string, any>;
};

export type Lesson = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  section: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  hasPlan: boolean;
  draftId: string | null;
  /** planned | taught | cancelled, as the schedule stores it. */
  status: string | null;
};

export type MaterialRow = {
  id: string;
  title: string;
  fileName: string | null;
  /** textbook | syllabus | notes | other | null */
  kind: string | null;
  pages: number | null;
  subject: string | null;
  grade: string | null;
  updatedAt: string | null;
};

/**
 * A unit of a subject — Murchid's `goals` row.
 *
 * The reference calls this a chapter, which assumes a syllabus was
 * parsed into one. Murchid does not parse chapters; it has goals, which
 * the schema describes as "a whole portion of a subject — a term, a
 * unit, a book". Same shape on screen, product's own noun.
 */
export type Unit = {
  id: string;
  title: string;
  /** processing | active | achieved | abandoned | failed */
  status: string | null;
  days: number | null;
  startDate: string | null;
  covered: boolean;
};

/**
 * A class: one subject taught to one grade.
 *
 * Keyed on subject AND grade, because Grade 8 Science and Grade 9
 * Science are not the same class — different syllabus, different
 * material, different children. Grouping on the subject alone put both
 * behind one sidebar row labelled with whichever grade happened to be
 * commonest, and quietly merged two terms' work into one library.
 *
 * Section is deliberately NOT part of the key. A lesson is written once
 * for Grade 9 and taught to 9A, 9B and 9C — db/tune.sql §48 says an
 * entry with a blank section reaches the whole grade — so keying on it
 * would triple the sidebar for classes that share every file. Sections
 * stay visible on the class page and in the composer, which is where
 * delivery is actually decided.
 *
 * The key uses normSubject/normGrade from shared/lib/classMatch, the
 * same mirrors of the SQL the delivery match uses. A sidebar that split
 * "Math" from "Mathematics" would be showing two classes the database
 * treats as one.
 */
/** One division of a class — `students.division`, which is real today. */
export type Division = {
  name: string;
  students: number;
};

/** A teaching_skills row, and whether it is pointed at this class. */
export type Skill = {
  id: string;
  name: string;
  sourceType: string | null;
  status: string | null;
  /** How the assignment reaches this class: "this class", "the grade", … */
  via: string;
};

export type SubjectGroup = {
  /** `${normSubject}|${normGrade}` — the class key. */
  key: string;
  /** The subject, as the teacher last typed it. */
  name: string;
  /** The grade, as stored. */
  grade: string | null;
  /** Normalised grade, for grouping the sidebar. */
  gradeKey: string;
  /** Kept for the callers that still ask; always one entry now. */
  grades: string[];
  /** Every section of this class that appears in the data. */
  sections: string[];
  /** Those sections with a roster count each — what the settings card shows. */
  divisions: Division[];
  /** Teaching skills whose assignment reaches this class. */
  skills: Skill[];
  /**
   * The year this class belongs to, off `classes.academic_year` (§102).
   *
   * Null when no `classes` row matches — the table predates the rest of
   * the product and a teacher who never opened the console has work but
   * no class row for it. The screens say "not filed under a year" rather
   * than stamping one on, because guessing which year a term belongs to
   * is exactly the mistake the column exists to stop.
   */
  academicYear: string | null;
  /** The matching `classes` row(s) — one per division. */
  classIds: string[];
  archived: boolean;
  items: Record<KindKey, Item[]>;
  total: number;
  students: number;
  lessons: Lesson[];
  /** Lessons in the coming week, and how many already have a plan. */
  weekTotal: number;
  weekWithPlan: number;
  materials: MaterialRow[];
  syllabus: MaterialRow | null;
  units: Unit[];
};

export type Waiting = {
  id: string;
  title: string;
  meta: string;
  kind: string;
  urgent: boolean;
};

/** One real class off the roster, section and all — what the composer offers. */
export type RosterClass = {
  grade: string;
  subject: string;
  section: string;
  count: number;
};

/**
 * Which of the three surfaces this account may actually look at.
 *
 * `roles` is my_roles() — a person can genuinely hold more than one, and
 * an admin who also teaches holds both. `permissions` is the resolved
 * capability map, admin.* half read from role_capabilities in the
 * database rather than from a constant, so a grant made in Roles & access
 * shows up here without a deploy.
 */
export type Identity = {
  roles: string[];
  permissions: Record<string, boolean>;
};

export type TeacherModel = {
  name: string;
  initials: string;
  school: string | null;
  today: string;
  todayLessons: Lesson[];
  weekTotal: number;
  weekWithPlan: number;
  subjects: SubjectGroup[];
  recent: Item[];
  waiting: Waiting[];
  /** Every artefact, newest first — what My Library reads. */
  all: Item[];
  /** Distinct (grade, section, subject) off the roster, for the composer. */
  rosterClasses: RosterClass[];
  /** Every goal, so the planner can group them by class. */
  units: (Unit & { subject: string | null; grade: string | null })[];
  identity: Identity;
  /** What the DATABASE says this year is — never computed in the browser. */
  currentYear: string;
  /** Every year that has anything in it, newest first. */
  years: string[];
};

// ── the student's side of the same structure ─────────────────────────
//
// A student's roster row IS a subject (db/tune.sql §student_subjects),
// so the nesting is already true in the database for them. What the
// preview adds is showing the work grouped by kind underneath it,
// rather than as one undifferentiated feed.

export type StudentWorkItem = {
  entryId: string;
  workId: string;
  kind: KindKey | "other";
  title: string;
  date: string | null;
  startTime: string | null;
  submitted: boolean;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  attemptStatus: string | null;
  upcoming: boolean;
};

export type StudentSubject = {
  studentRowId: string;
  subject: string;
  grade: string | null;
  section: string | null;
  teacher: string | null;
  workCount: number;
  /** Filled in when the subject is opened — student_class() is per-row. */
  work: StudentWorkItem[] | null;
  loading: boolean;
  error: string | null;
};

export type StudentModel = {
  name: string;
  initials: string;
  grade: string | null;
  section: string | null;
  school: string | null;
  subjects: StudentSubject[];
  attendance: { present: number; absent: number; late: number; total: number } | null;
  scores: { id: string; title: string; score: number | null; maxScore: number | null; submittedAt: string | null }[];
  grades: { subject: string | null; term: string | null; label: string | null; score: number | null; maxScore: number | null; recordedOn: string | null }[];
  noClasses: boolean;
  /**
   * Whether the signed-in account is actually a student.
   *
   * A teacher flipping to this tab gets the same empty answer from
   * student_dashboard() as a student with no classes, and those are
   * completely different situations to be told about.
   */
  isStudent: boolean;
};
