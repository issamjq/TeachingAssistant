"use client";

// =====================================================================
// The teacher's classes — one answer, for everything that asks
//
// There were two, and they disagreed. The sidebar merged the `classes`
// table with the roster; every class picker in the studio derived its
// list from the roster alone. So a class with a row and no students yet
// — which is every class between creating it and enrolling anybody —
// appeared in the rail, sent a teacher to /presentations scoped to it,
// and then could not be selected in the composer standing on that
// screen. The composer said "any class" about a class she had just
// clicked.
//
// Neither source is sufficient by itself:
//
//   `classes` is the real table and carries the academic year (§102),
//   but it is newer than everything around it and a teacher who never
//   opened the console has no rows in it at all.
//
//   The roster is one row per child, so it knows the divisions and the
//   counts — and cannot see a class nobody is enrolled in.
//
// Merged, the roster wins on anything it knows (it has the count), and
// `classes` adds what it alone has. A class with no students is offered
// with the truth attached rather than hidden: it is a real class, and
// the delivery preview will say plainly that nothing reaches anybody.
// =====================================================================

import { useEffect, useState } from "react";
import { api } from "./apiClient";
import { distinctClasses, normGrade, normSubject, type RosterStudent, type TeacherClass } from "./classMatch";

type ClassRow = {
  id: string;
  subject: string | null;
  grade: string | null;
  division: string | null;
  academic_year: string | null;
  is_archived: boolean | null;
};

/** The same key `distinctClasses` groups on, so the two merge cleanly. */
export const teacherClassKey = (c: { grade?: string | null; section?: string | null; subject?: string | null }) =>
  [
    normGrade(c.grade ?? "") ?? "",
    String(c.section ?? "").trim().toLowerCase(),
    normSubject(c.subject ?? "") ?? "",
  ].join("§");

const TTL_MS = 60_000;
let cached: { at: number; promise: Promise<TeacherClass[]> } | null = null;

/** Drop the cache when a class or a roster row changes under us. */
export function invalidateTeacherClasses() {
  cached = null;
}

async function load(): Promise<TeacherClass[]> {
  const [rows, roster] = await Promise.all([
    api<ClassRow[]>("/api/classes").catch(() => [] as ClassRow[]),
    api<RosterStudent[]>("/api/students").catch(() => [] as RosterStudent[]),
  ]);

  const out = new Map<string, TeacherClass>();
  for (const c of distinctClasses(Array.isArray(roster) ? roster : [])) {
    out.set(teacherClassKey(c), c);
  }
  for (const c of Array.isArray(rows) ? rows : []) {
    // Archived is last year's. It stays readable everywhere else and is
    // simply not offered as somewhere to write today.
    if (c?.is_archived) continue;
    const grade = String(c.grade ?? "").trim();
    const subject = String(c.subject ?? "").trim();
    const section = String(c.division ?? "").trim();
    if (!grade && !subject) continue;
    const key = teacherClassKey({ grade, section, subject });
    // The roster's entry wins: it is the one carrying a real count.
    if (!out.has(key)) out.set(key, { grade, subject, section, count: 0 });
  }

  return [...out.values()].sort(
    (a, b) =>
      (normGrade(a.grade) || "").localeCompare(normGrade(b.grade) || "", undefined, { numeric: true }) ||
      a.section.localeCompare(b.section) ||
      a.subject.localeCompare(b.subject),
  );
}

function fetchClasses(): Promise<TeacherClass[]> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.promise;
  const promise = load().catch(() => {
    cached = null;
    return [] as TeacherClass[];
  });
  cached = { at: now, promise };
  return promise;
}

/**
 * `ready` separates "no classes" from "not loaded yet" — a picker that
 * says "any class" while it is still loading is telling a teacher her
 * class does not exist.
 */
export function useTeacherClasses(): { classes: TeacherClass[]; ready: boolean } {
  const [state, setState] = useState<{ classes: TeacherClass[]; ready: boolean }>({
    classes: [],
    ready: false,
  });
  useEffect(() => {
    let live = true;
    fetchClasses().then((classes) => { if (live) setState({ classes, ready: true }); });
    return () => { live = false; };
  }, []);
  return state;
}
