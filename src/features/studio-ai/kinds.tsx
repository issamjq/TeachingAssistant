// The five things the studio writes, in one place.
//
// This list used to live inside StudioChat, which was fine while the
// composer only existed there. It is rendered on every library screen
// now — Lessons, Quizzes, Homework, Presentations, Activities — and two
// copies of "what the studio can make" would disagree the first time a
// sixth was added to one of them.

import { ClipboardList, FileText, GraduationCap, Layers, Puzzle, type LucideIcon } from "lucide-react";

export type StudioKind =
  | "lesson_plan" | "quiz" | "homework" | "presentation" | "activity";

export const KINDS: { value: StudioKind; label: string; icon: LucideIcon }[] = [
  { value: "lesson_plan",  label: "Lesson",       icon: FileText },
  { value: "quiz",         label: "Quiz",         icon: GraduationCap },
  { value: "homework",     label: "Homework",     icon: ClipboardList },
  { value: "presentation", label: "Presentation", icon: Layers },
  { value: "activity",     label: "Activity",     icon: Puzzle },
];

export const KIND_LABEL: Record<string, string> =
  Object.fromEntries(KINDS.map((k) => [k.value, k.label]));
