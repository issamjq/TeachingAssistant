// =====================================================================
// What class a file looks like it belongs to — a suggestion, never a fact
//
// 19 materials arrived with no class at all, and their names often say
// one: "CBSE Class 9 Maths Syllabus 2026-27.pdf". Writing that into the
// database would be a guess presented as a fact, and a syllabus filed
// under the wrong class grounds every lesson generated from it. So this
// proposes, and the teacher taps to confirm.
//
// Two independent signals have to agree before anything is offered:
//
//   the FILENAME has to name a grade, and
//   the SUBJECT has to be one this teacher actually teaches, matched
//   against her own classes rather than a list of subjects invented here.
//
// That second rule is what keeps it conservative. "Class 10 Maths" is
// only suggested to somebody who teaches Grade 10 Maths; to anybody else
// it stays unfiled, which is the honest answer.
// =====================================================================

import { normGrade, normSubject, type TeacherClass } from "@/shared/lib/classMatch";

/** "Class 9", "Grade 9", "G9", "Std 9", "9th" — the ways a file says it. */
const GRADE_RE = /(?:\b(?:class|grade|std|standard|year)\s*[-_ ]?(\d{1,2})\b)|(?:\bg[-_ ]?(\d{1,2})\b)|(?:\b(\d{1,2})\s*(?:st|nd|rd|th)\b)/i;

function gradeIn(name: string): string | null {
  const m = GRADE_RE.exec(name.replace(/[._-]+/g, " "));
  if (!m) return null;
  const n = Number(m[1] ?? m[2] ?? m[3]);
  // A school grade, not a chapter number or a year. 13 is the ceiling in
  // every system this product serves.
  return Number.isFinite(n) && n >= 1 && n <= 13 ? String(n) : null;
}

/**
 * The classes this file plausibly belongs to, best first.
 *
 * Returns [] rather than a guess whenever the two signals do not agree,
 * which is most of the time and is the correct outcome.
 */
export function suggestClasses(fileName: string, classes: TeacherClass[]): TeacherClass[] {
  const name = String(fileName || "");
  if (!name.trim() || !classes.length) return [];

  const grade = gradeIn(name);
  const haystack = ` ${name.toLowerCase().replace(/[._\-—–]+/g, " ")} `;

  /**
   * Both sides go through normSubject before they are compared.
   *
   * "Maths G10 — Chapter 6 Quadratics.pdf" belongs to a class stored as
   * "Mathematics", and a raw substring match misses it — which it did.
   * normSubject folds maths / math / mathematics onto one value, so the
   * comparison is the same one delivery makes.
   */
  const words = haystack.split(/\s+/).filter(Boolean);
  const spoken = new Set(
    words
      .flatMap((w, i) => [w, `${w} ${words[i + 1] ?? ""}`.trim()])
      .map((w) => normSubject(w))
      .filter(Boolean) as string[],
  );

  const hits = classes.filter((c) => {
    const subject = normSubject(c.subject);
    if (!subject) return false;
    if (!spoken.has(subject)) return false;
    return grade ? normGrade(c.grade) === grade : false;
  });

  // Every division of the matching grade+subject, since a syllabus that
  // names Grade 9 Maths belongs to 9A and 9B alike.
  return hits;
}

/** "Grade 9 · Maths" — what the prompt offers, said once. */
export function suggestionLabel(hits: TeacherClass[]): string {
  if (!hits.length) return "";
  const { grade, subject } = hits[0];
  const g = grade.trim();
  const shown = /^\d+$/.test(g) ? `Grade ${g}` : g;
  const divisions = hits.map((h) => h.section).filter(Boolean);
  return [shown, subject, divisions.length > 1 ? `${divisions.length} divisions` : divisions[0]]
    .filter(Boolean)
    .join(" · ");
}
