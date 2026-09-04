import { supabase } from "@/lib/supabase/client";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export interface SharedMaterialRow {
  id: string;
  title: string;
  kind: string;
  subject: string | null;
  syllabus: string | null;
  grade_level: number | null;
  created_at: string;
}

export interface SharedMaterialFilters {
  syllabus?: string;
  gradeLevel?: number;
  subject?: string;
}

export async function listSharedMaterials(
  filters: SharedMaterialFilters = {},
): Promise<SharedMaterialRow[]> {
  const db = requireClient();
  let query = db
    .from("materials")
    .select("id, title, kind, subject, syllabus, grade_level, created_at")
    .eq("is_shared", true)
    .order("syllabus", { ascending: true })
    .order("grade_level", { ascending: true })
    .order("subject", { ascending: true });

  if (filters.syllabus) query = query.eq("syllabus", filters.syllabus);
  if (filters.gradeLevel) query = query.eq("grade_level", filters.gradeLevel);
  if (filters.subject) query = query.ilike("subject", `%${filters.subject}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SharedMaterialRow[];
}

export async function attachExistingMaterial(
  ownerId: string,
  classId: string,
  materialId: string,
): Promise<void> {
  const db = requireClient();
  const { error } = await db
    .from("class_materials")
    .insert({ class_id: classId, material_id: materialId, owner_id: ownerId });
  if (error) throw error;
}

export interface NewSharedMaterialInput {
  title: string;
  syllabus: string;
  gradeLevel: number;
  subject: string;
  bodyMd: string;
}

export async function createSharedMaterial(
  ownerId: string,
  input: NewSharedMaterialInput,
): Promise<SharedMaterialRow> {
  const db = requireClient();
  const { data, error } = await db
    .from("materials")
    .insert({
      owner_id: ownerId,
      title: input.title,
      kind: "note",
      syllabus: input.syllabus,
      grade_level: input.gradeLevel,
      subject: input.subject,
      body_md: input.bodyMd,
      is_shared: true,
    })
    .select("id, title, kind, subject, syllabus, grade_level, created_at")
    .single();
  if (error) throw error;
  return data as SharedMaterialRow;
}

export async function deleteSharedMaterial(id: string): Promise<void> {
  const db = requireClient();
  const { error } = await db.from("materials").delete().eq("id", id);
  if (error) throw error;
}
