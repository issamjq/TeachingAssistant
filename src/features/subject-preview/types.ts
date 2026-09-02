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

export type SubjectGroup = {
  /** Case-folded, whitespace-collapsed — the grouping key. */
  key: string;
  /** As the teacher last typed it. */
  name: string;
  /** Every grade this subject is taught to, most-used first. */
  grades: string[];
  sections: string[];
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
};
