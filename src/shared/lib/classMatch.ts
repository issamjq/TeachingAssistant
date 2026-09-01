// The delivery rule, readable by the UI.
//
// Students receive work through one mechanism only: a schedule entry
// carrying a generation, whose grade / subject / section text-match the
// student's roster row (db/tune.sql §48). That match is decided in SQL,
// invisible to the teacher — so every screen that writes or shows an
// audience uses THIS mirror of it to say, before and after saving, who
// will actually receive the work.
//
// These functions must stay faithful to the SQL, not improve on it. A
// preview that is kinder than the database lies to the teacher; the SQL
// is the truth being previewed. If §48 changes, change this file in the
// same commit.

/** One roster row as the data layer serves it (students → outStudent). */
export interface RosterStudent {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  grade?: string | null;
  /** `students.division` — served to the UI as `section`. */
  section?: string | null;
  subject?: string | null;
}

/** The audience fields of a schedule entry (or a draft about to become one). */
export interface Audience {
  grade?: string | null;
  subject?: string | null;
  section?: string | null;
}

/** A distinct class a teacher actually has, derived from her roster. */
export interface TeacherClass extends Audience {
  grade: string;
  subject: string;
  section: string;
  /** How many roster rows sit behind this combination. */
  count: number;
}

/**
 * Mirror of public.norm_grade: 'Grade 5', 'grade5', 'G5', '5' → '5'.
 * KG and Reception carry no digits and compare as lowercased text.
 * Blank → null, so a missing value never equals another missing value
 * by accident — except in the IS NOT DISTINCT FROM comparison below,
 * which is the SQL's own behaviour.
 */
export function normGrade(value: string | null | undefined): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  return digits !== "" ? digits : v.toLowerCase();
}

/**
 * Mirror of public.norm_subject: case, spacing, and the one genuine
 * synonym set in UAE schools. Deliberately short — guessing that "Bio"
 * means Biology would hide a typo from the teacher instead of showing it.
 */
export function normSubject(value: string | null | undefined): string | null {
  const v = String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (!v) return null;
  if (v === "math" || v === "maths" || v === "mathematics") return "math";
  if (v === "ict" || v === "computing") return "computer science";
  return v;
}

/**
 * Does this audience reach this student? The §48 join, term by term:
 *
 *   - grade: grade_matches — one value or a comma-joined list ("Grade 9,
 *     Grade 11") reaching a student when ANY member matches; a blank
 *     entry grade matches only a blank student grade;
 *   - subject: an entry with no subject reaches every subject;
 *   - section: section_matches — blank reaches the whole grade, and a
 *     comma-joined list reaches any of its members.
 */
export function audienceReaches(audience: Audience, student: RosterStudent): boolean {
  const entryGrade = String(audience.grade ?? "");
  const studentGrade = normGrade(student.grade);
  if (normGrade(entryGrade) === null) {
    if (studentGrade !== null) return false;
  } else if (!entryGrade.split(",").some((g) => normGrade(g) === studentGrade)) {
    return false;
  }
  const subj = normSubject(audience.subject);
  if (subj !== null && subj !== normSubject(student.subject)) return false;
  const section = String(audience.section ?? "").trim();
  if (section !== "") {
    const division = String(student.section ?? "").trim().toLowerCase();
    const hit = section
      .split(",")
      .some((s) => s.trim() !== "" && s.trim().toLowerCase() === division);
    if (!hit) return false;
  }
  return true;
}

/** Every roster student this audience reaches. */
export function matchRoster(audience: Audience, roster: RosterStudent[]): RosterStudent[] {
  return roster.filter((s) => audienceReaches(audience, s));
}

/**
 * The teacher's real classes: distinct (grade, section, subject) rows in
 * her roster, with how many students each holds. This is what the class
 * pickers offer — values copied straight from roster rows can never lose
 * to the text match, which is the whole point of offering them.
 */
export function distinctClasses(roster: RosterStudent[]): TeacherClass[] {
  const byKey = new Map<string, TeacherClass>();
  for (const s of roster) {
    const grade = String(s.grade ?? "").trim();
    const subject = String(s.subject ?? "").trim();
    const section = String(s.section ?? "").trim();
    if (!grade && !subject) continue; // a row with neither can't name a class
    const key = [normGrade(grade), section.toLowerCase(), normSubject(subject)].join("§");
    const hit = byKey.get(key);
    if (hit) hit.count += 1;
    else byKey.set(key, { grade, subject, section, count: 1 });
  }
  return [...byKey.values()].sort(
    (a, b) =>
      (normGrade(a.grade) || "").localeCompare(normGrade(b.grade) || "", undefined, { numeric: true }) ||
      a.section.localeCompare(b.section) ||
      a.subject.localeCompare(b.subject),
  );
}

/** "Grade 6 · A · Science" — the class, said the way a teacher says it. */
export function classLabel(a: Audience): string {
  const grade = String(a.grade ?? "").trim();
  return [
    // The scheduler stores bare "6"; a teacher says "Grade 6".
    /^\d+$/.test(grade) ? `Grade ${grade}` : grade,
    String(a.section ?? "").trim(),
    String(a.subject ?? "").trim(),
  ]
    .filter(Boolean)
    .join(" · ");
}
