// The §105 surface, typed.
//
// Every call goes through the same api() the rest of the studio uses, so
// these are Supabase reads and writes with RLS doing the authorisation —
// there is no server here. See src/lib/data/index.ts.

import { api } from "@/shared/lib/apiClient";

export type Subject = {
  id: string;
  name: string;
  name_ar: string | null;
  is_archived: boolean;
  /** False for the built-in MAJORS list, which cannot be renamed. */
  custom: boolean;
};

export type Division = {
  id: string;
  grade: string;
  division: string;
  academic_year: string;
  is_archived: boolean;
  students: number;
  /** The subjects taught to this roll — all of them share it. */
  subjects: string[];
};

export type RollEntry = {
  id: string;
  member_id: string;
  first_name: string | null;
  last_name: string | null;
  student_code: string | null;
  email: string | null;
};

export type ClassRow = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  division: string | null;
  academic_year: string | null;
  division_id: string | null;
  is_archived: boolean;
};

export const listSubjects = () => api<Subject[]>("/api/subjects");

export const createSubject = (name: string, name_ar?: string) =>
  api<Subject>("/api/subjects", { method: "POST", body: { name, name_ar: name_ar || null } });

export const archiveSubject = (id: string) =>
  api<{ ok: true }>(`/api/subjects/${id}`, { method: "DELETE" });

export const listDivisions = () => api<Division[]>("/api/divisions");

export const createDivision = (grade: string, division: string) =>
  api<Division>("/api/divisions", { method: "POST", body: { grade, division } });

export const divisionRoll = (id: string) => api<RollEntry[]>(`/api/divisions/${id}/roll`);

export const addToDivision = (id: string, student_ids: string[]) =>
  api<{ added: number }>(`/api/divisions/${id}/roll`, { method: "POST", body: { student_ids } });

export const removeFromDivision = (id: string, student_id: string) =>
  api<{ ok: true }>(`/api/divisions/${id}/roll`, { method: "DELETE", body: { student_id } });

export const listClasses = () => api<ClassRow[]>("/api/classes");

export const teachSubject = (subject: string, division_id: string) =>
  api<ClassRow>("/api/classes", { method: "POST", body: { subject, division_id } });

export const classRoster = (id: string) => api<RollEntry[]>(`/api/classes/${id}/roster`);

/**
 * Add or drop one student for THIS subject only — the elective case.
 *
 * 'exclude' is what makes "everyone in 9-A except the three doing
 * French" expressible without breaking the shared roll; 'include' pulls
 * in a student the division does not have; 'clear' removes the exception
 * and lets the division decide again.
 */
export const setClassException = (
  id: string,
  student_id: string,
  mode: "include" | "exclude" | "clear"
) => api<{ ok: true }>(`/api/classes/${id}/roster`, { method: "PUT", body: { student_id, mode } });

/**
 * Start a subject over for next year's children.
 *
 * Returns what it carried and — said explicitly by the database function
 * itself — what it left behind, so the screen can report both rather
 * than implying the roll came too.
 */
export const rollYear = (id: string, opts: { academic_year?: string; goals?: boolean; archive?: boolean } = {}) =>
  api<{
    class_id: string;
    academic_year: string;
    carried_work: number;
    carried_goals: number;
    archived: boolean;
    left_behind: string[];
  }>(`/api/classes/${id}/rollover`, { method: "POST", body: opts });
