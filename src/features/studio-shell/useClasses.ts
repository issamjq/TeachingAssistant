"use client";

// =====================================================================
// The classes a teacher has, for the sidebar
//
// The merge of `classes` and the roster lives in
// shared/lib/teacherClasses — one answer for the rail and for every
// class picker in the studio. They used to compute it separately and
// disagree: a class with a row and no students yet appeared here, sent
// a teacher to a library scoped to it, and could not then be selected
// in the composer on that screen.
//
// What this adds is the GROUPING. The rail files a class by subject AND
// grade — Grade 8 Science and Grade 9 Science are not one class — with
// the division kept as a detail rather than as part of the key, because
// a lesson is written once for Grade 9 and taught to 9A, 9B and 9C.
// =====================================================================

import { useMemo } from "react";
import { normGrade } from "@/shared/lib/classMatch";
import { classScopeKey } from "@/shared/lib/classScope";
import { useTeacherClasses } from "@/shared/lib/teacherClasses";

export type TeacherClassGroup = {
  /** `${normSubject}|${normGrade}` — matches classScopeKey(). */
  key: string;
  subject: string;
  grade: string;
  /** Normalised grade, for grouping the rail. */
  gradeKey: string;
  divisions: string[];
  students: number;
};

/**
 * The rail's view of the same classes: one entry per subject+grade,
 * with the divisions and the roll folded in.
 *
 * `ready` separates "no classes" from "not loaded yet" — the sidebar
 * falls back to a flat list of libraries when there are none, and
 * flashing that fallback for a teacher who has twelve would be worse
 * than showing nothing for a moment.
 */
export function useClasses(): { classes: TeacherClassGroup[]; ready: boolean } {
  const { classes: flat, ready } = useTeacherClasses();

  const classes = useMemo(() => {
    const groups = new Map<string, TeacherClassGroup>();
    for (const c of flat) {
      const subject = c.subject.trim();
      if (!subject) continue;
      const key = classScopeKey(subject, c.grade);
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          subject,
          grade: c.grade.trim(),
          gradeKey: normGrade(c.grade) ?? "",
          divisions: [],
          students: 0,
        };
        groups.set(key, g);
      }
      const d = c.section.trim();
      if (d && !g.divisions.includes(d)) g.divisions.push(d);
      g.students += c.count;
    }
    return [...groups.values()].sort(
      (a, b) =>
        a.gradeKey.localeCompare(b.gradeKey, undefined, { numeric: true }) ||
        a.subject.localeCompare(b.subject),
    );
  }, [flat]);

  return { classes, ready };
}

