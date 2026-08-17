import type { DocKind } from "./types";

// Human labels for the machine kinds the library speaks. Kept here so the
// card, the drawer tabs and the import menu all name a document the same
// way.
export const KIND_LABEL: Record<DocKind, string> = {
  lesson_plan: "Lesson plan",
  teaching_guide: "Teaching guide",
  student_notes: "Student notes",
  presentation: "Presentation",
  quiz: "Quiz",
  homework: "Homework",
  activity: "Activity",
};

// Which library kinds map onto one of the teacher's own artifact stores,
// and where. teaching_guide / student_notes have no dedicated store, so
// they are Studio-only (below) rather than importable.
export const IMPORT_PATH: Partial<Record<DocKind, string>> = {
  lesson_plan: "/api/drafts",
  quiz: "/api/quizzes",
  homework: "/api/homework",
  presentation: "/api/presentations",
  activity: "/api/activities",
};

// Where an imported document lands, and how to get there. The four list
// sections open to their own list (the fresh row sorts to the top);
// lesson plans have no list, so they open straight in the draft editor
// by id — the one surface that shows a single saved lesson.
export const IMPORT_DEST: Partial<
  Record<DocKind, { label: string; route: (id: string) => string[] }>
> = {
  lesson_plan: { label: "Lessons", route: (id) => ["lesson-plans", "edit", id] },
  quiz: { label: "Quizzes & exams", route: () => ["quizzes"] },
  homework: { label: "Homework", route: () => ["homework"] },
  presentation: { label: "Presentations", route: () => ["presentations"] },
  activity: { label: "Activities", route: () => ["activities"] },
};

// The Studio understands these five kinds. A guide or notes opens there
// as a lesson — the closest editable shape.
export const STUDIO_KIND: Record<DocKind, string> = {
  lesson_plan: "lesson_plan",
  teaching_guide: "lesson_plan",
  student_notes: "lesson_plan",
  presentation: "presentation",
  quiz: "quiz",
  homework: "homework",
  activity: "activity",
};

/** Title-case a snake/lower subject slug for display. */
export function subjectLabel(subject: string): string {
  if (!subject) return "";
  return subject
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
