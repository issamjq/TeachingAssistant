import { supabase } from "@/lib/supabase/client";

export interface ClassRow {
  id: string;
  subject: string;
  division_id: string;
}

export interface DivisionRow {
  id: string;
  label: string;
  grade_id: string;
  classes: ClassRow[];
}

export interface GradeRow {
  id: string;
  level: number;
  batch_id: string;
  divisions: DivisionRow[];
}

export interface BatchRow {
  id: string;
  label: string;
  start_year: number;
  grades: GradeRow[];
}

export interface ClassWithPath extends ClassRow {
  division: { id: string; label: string };
  grade: { id: string; level: number };
  batch: { id: string; label: string };
}

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export async function listHierarchy(): Promise<BatchRow[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("batches")
    .select(
      "id, label, start_year, grades(id, level, batch_id, divisions(id, label, grade_id, classes(id, subject, division_id)))",
    )
    .order("start_year", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BatchRow[];
}

export async function getClassWithPath(
  classId: string,
): Promise<ClassWithPath | null> {
  const db = requireClient();
  const { data, error } = await db
    .from("classes")
    .select(
      "id, subject, division_id, division:divisions(id, label, grade:grades(id, level, batch:batches(id, label)))",
    )
    .eq("id", classId)
    .single();
  if (error) return null;
  const row = data as unknown as {
    id: string;
    subject: string;
    division_id: string;
    division: { id: string; label: string; grade: { id: string; level: number; batch: { id: string; label: string } } };
  };
  return {
    id: row.id,
    subject: row.subject,
    division_id: row.division_id,
    division: { id: row.division.id, label: row.division.label },
    grade: { id: row.division.grade.id, level: row.division.grade.level },
    batch: { id: row.division.grade.batch.id, label: row.division.grade.batch.label },
  };
}

export async function createBatch(ownerId: string, label: string, startYear: number) {
  const db = requireClient();
  const { data, error } = await db
    .from("batches")
    .insert({ owner_id: ownerId, label, start_year: startYear })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createGrade(ownerId: string, batchId: string, level: number) {
  const db = requireClient();
  const { data, error } = await db
    .from("grades")
    .insert({ owner_id: ownerId, batch_id: batchId, level })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createDivision(ownerId: string, gradeId: string, label: string) {
  const db = requireClient();
  const { data, error } = await db
    .from("divisions")
    .insert({ owner_id: ownerId, grade_id: gradeId, label })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createClass(ownerId: string, divisionId: string, subject: string) {
  const db = requireClient();
  const { data, error } = await db
    .from("classes")
    .insert({ owner_id: ownerId, division_id: divisionId, subject })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface StudentRow {
  id: string;
  name: string;
  roll_no: string | null;
  email: string | null;
  status: "invited" | "active" | "removed";
}

export async function listClassStudents(classId: string): Promise<StudentRow[]> {
  const db = requireClient();
  const { data, error } = await db
    .from("class_members")
    .select("student:students(id, name, roll_no, email, status)")
    .eq("class_id", classId);
  if (error) throw error;
  return ((data ?? []) as unknown as { student: StudentRow }[]).map((r) => r.student);
}

export async function inviteStudent(
  ownerId: string,
  classId: string,
  input: { name: string; rollNo?: string; email?: string },
): Promise<StudentRow> {
  const db = requireClient();
  const { data: student, error: studentError } = await db
    .from("students")
    .insert({
      owner_id: ownerId,
      name: input.name,
      roll_no: input.rollNo || null,
      email: input.email || null,
      status: "invited",
    })
    .select()
    .single();
  if (studentError) throw studentError;

  const { error: memberError } = await db
    .from("class_members")
    .insert({ class_id: classId, student_id: student.id, owner_id: ownerId });
  if (memberError) throw memberError;

  return student as StudentRow;
}
