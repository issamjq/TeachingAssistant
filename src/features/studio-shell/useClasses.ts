"use client";

// =====================================================================
// The classes a teacher has, for the sidebar
//
// Two sources, because neither alone is the truth:
//
//   `classes` is the real table and carries the academic year (§102),
//   but it predates everything else and a teacher who never opened the
//   console has none — three of the five rows in it were written by a
//   seed. Read alone it would show an empty rail to somebody with a
//   term of work.
//
//   The roster is the source every other class picker in the product
//   already uses (`distinctClasses`), and it has one row per child, so a
//   class she has drafted for but not yet enrolled anybody in is
//   invisible to it.
//
// Merged, keyed on subject AND grade — Grade 8 Science and Grade 9
// Science are not one class — with the division kept as a detail rather
// than as part of the key, because a lesson is written once for Grade 9
// and taught to 9A, 9B and 9C.
// =====================================================================

import { useEffect, useState } from "react";
import { api } from "@/shared/lib/apiClient";
import { distinctClasses, normGrade, normSubject, type RosterStudent } from "@/shared/lib/classMatch";
import { classScopeKey } from "@/shared/lib/classScope";

export type TeacherClassGroup = {
  /** `${normSubject}|${normGrade}` — matches classScopeKey(). */
  key: string;
  subject: string;
  grade: string;
  /** Normalised grade, for grouping the rail. */
  gradeKey: string;
  divisions: string[];
  students: number;
  academicYear: string | null;
};

type ClassRow = {
  id: string; subject: string | null; grade: string | null; division: string | null;
  academic_year: string | null; is_archived: boolean | null;
};

const TTL_MS = 60_000;
let cached: { at: number; promise: Promise<TeacherClassGroup[]> } | null = null;

/** Discard the cache when the roster or a class changes under us. */
export function invalidateClasses() {
  cached = null;
}

async function load(): Promise<TeacherClassGroup[]> {
  const [rows, roster] = await Promise.all([
    api<ClassRow[]>("/api/classes").catch(() => [] as ClassRow[]),
    api<RosterStudent[]>("/api/students").catch(() => [] as RosterStudent[]),
  ]);

  const groups = new Map<string, TeacherClassGroup>();
  const add = (subject: unknown, grade: unknown, division: unknown, year: string | null) => {
    const s = String(subject ?? "").trim();
    if (!s) return null;
    const key = classScopeKey(s, grade);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        subject: s,
        grade: String(grade ?? "").trim(),
        gradeKey: normGrade(String(grade ?? "")) ?? "",
        divisions: [],
        students: 0,
        academicYear: null,
      };
      groups.set(key, g);
    }
    const d = String(division ?? "").trim();
    if (d && !g.divisions.includes(d)) g.divisions.push(d);
    // The newest year among the rows of one class wins; a class taught
    // across two divisions has two rows and one year.
    if (year && (!g.academicYear || year > g.academicYear)) g.academicYear = year;
    return g;
  };

  // Archived classes are last year's. They stay readable everywhere else
  // and are simply not offered as somewhere to work today.
  for (const c of Array.isArray(rows) ? rows : []) {
    if (c?.is_archived) continue;
    add(c.subject, c.grade, c.division, c.academic_year);
  }
  for (const c of distinctClasses(Array.isArray(roster) ? roster : [])) {
    const g = add(c.subject, c.grade, c.section, null);
    if (g) g.students += c.count;
  }

  return [...groups.values()].sort(
    (a, b) =>
      a.gradeKey.localeCompare(b.gradeKey, undefined, { numeric: true }) ||
      a.subject.localeCompare(b.subject),
  );
}

function fetchClasses(): Promise<TeacherClassGroup[]> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.promise;
  const promise = load().catch(() => {
    cached = null;
    return [] as TeacherClassGroup[];
  });
  cached = { at: now, promise };
  return promise;
}

/**
 * `ready` separates "no classes" from "not loaded yet" — the sidebar
 * falls back to a flat list of libraries when there are none, and
 * flashing that fallback for a teacher who has twelve would be worse
 * than showing nothing for a moment.
 */
export function useClasses(enabled = true): { classes: TeacherClassGroup[]; ready: boolean } {
  const [state, setState] = useState<{ classes: TeacherClassGroup[]; ready: boolean }>({
    classes: [],
    ready: false,
  });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetchClasses().then((classes) => { if (live) setState({ classes, ready: true }); });
    return () => { live = false; };
  }, [enabled]);
  return state;
}

export { normSubject };
