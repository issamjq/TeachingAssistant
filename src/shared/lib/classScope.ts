"use client";

// =====================================================================
// Which class the library screens are showing
//
// The sidebar stopped being a list of libraries and became a list of
// CLASSES: open Physics · Grade 9 and its lesson plans, quizzes and
// homework hang underneath it. Those still land on /lesson-plans,
// /quizzes and /homework — one screen per kind, as before — so something
// has to carry "and only Physics, Grade 9" across the navigation.
//
// This is that something. Deliberately NOT in the URL: `navigate()` is a
// shim over the App Router that builds a path out of segments and has no
// notion of a query, and teaching it one during a migration that is
// deleting it in Phase 4 would be scaffolding on scaffolding. It lives
// in a module with subscribers instead, persisted the same way the
// studio's own class picker persists its pick.
//
// The cost of that choice is that a scoped screen is not a link you can
// send, and that the scope survives a reload. Both are paid for by the
// chip: every screen that filters shows which class it is showing and a
// way out of it, in the page header, where it cannot be missed.
// =====================================================================

import { useSyncExternalStore } from "react";
import { normGrade, normSubject } from "./classMatch";

export type ClassScope = {
  /** As the teacher typed it, for showing. */
  subject: string;
  grade: string;
  /** `${normSubject}|${normGrade}`, for comparing. */
  key: string;
};

const KEY = "murchid.studio.class-scope";

let current: ClassScope | null = read();
const listeners = new Set<() => void>();

function read(): ClassScope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.subject === "string" ? v : null;
  } catch {
    return null;
  }
}

export function classScopeKey(subject: unknown, grade: unknown): string {
  return `${normSubject(subject as string) ?? ""}|${normGrade(grade as string) ?? ""}`;
}

/** Point every library screen at one class, or at all of them with null. */
export function setClassScope(next: ClassScope | null) {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* private browsing: the scope lasts the session instead */
  }
  for (const fn of listeners) fn();
}

export function getClassScope(): ClassScope | null {
  return current;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * The current scope.
 *
 * The server snapshot is always null: a scope read from localStorage
 * during hydration would render a filtered list the server rendered
 * unfiltered, which React reports as a hydration mismatch and resolves
 * by throwing one of them away.
 */
export function useClassScope(): ClassScope | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** "Grade 9 · Physics" — the class, said the way a teacher says it. */
export function classScopeLabel(scope: ClassScope): string {
  const g = scope.grade.trim();
  return [/^\d+$/.test(g) ? `Grade ${g}` : g, scope.subject.trim()]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Rows for this class only.
 *
 * A row with no subject at all stays in: it belongs to no class, so
 * hiding it behind a class filter would make it unreachable from a
 * sidebar that only offers classes. It is visible everywhere instead,
 * which is the state that gets it fixed.
 */
export function filterByClassScope<T extends Record<string, any>>(
  items: T[],
  scope: ClassScope | null,
): T[] {
  if (!scope) return items;
  const [subject, grade] = scope.key.split("|");
  const fits = (s: string | null, g: string | null) => {
    if (!s) return true;
    if (s !== subject) return false;
    // Something that names a subject but no grade belongs to every grade
    // of it — the same rule §48 uses when it delivers one.
    return !g || !grade || g === grade;
  };
  return items.filter((it) => {
    /**
     * A material names its classes in a table of its own (§103), and one
     * file can serve three of them — a Term 1 scheme of work covering
     * Physics 9, Physics 11 and Mathematics 10 is one document, not
     * three. Its own grade/subject columns hold only the FIRST of those,
     * so filtering on them hid it from the other two.
     */
    const filed = it.classes as { grade?: string | null; subject?: string | null }[] | undefined;
    if (Array.isArray(filed) && filed.length) {
      return filed.some((c) => fits(normSubject(c.subject), normGrade(c.grade)));
    }
    return fits(normSubject(it.subject), normGrade(it.grade));
  });
}
