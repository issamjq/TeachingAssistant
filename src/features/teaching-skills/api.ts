// All network access for the teaching-skills feature. Everything here is
// answered browser→Supabase by src/lib/data (RLS scopes rows to the
// teacher); no request actually leaves the origin.
import { api } from "@/shared/lib/apiClient";

export interface SkillRow {
  id: string;
  name: string | null;
  source_type: string | null;
  skill_profile: string | null;
  status: "processing" | "ready" | "failed";
  created_at: string;
  updated_at: string;
}

export const listSkills = () => api<SkillRow[]>("/api/skills");

export const createSkill = (body: { name: string; source_type: string; skill_profile: string }) =>
  api<SkillRow>("/api/skills", { method: "POST", body });

export const updateSkill = (id: string, body: Partial<Pick<SkillRow, "name" | "skill_profile" | "status">>) =>
  api<SkillRow>(`/api/skills/${id}`, { method: "PATCH", body });

export const deleteSkill = (id: string) =>
  api<{ ok: true }>(`/api/skills/${id}`, { method: "DELETE" });

// Where a skill applies. NULL grade/section/subject means "any" — the
// same audience vocabulary the scheduler and bulletin board use.
export interface SkillAssignment {
  id: string;
  skill_id: string;
  grade: string | null;
  section: string | null;
  subject: string | null;
  created_at: string;
}

export const listAssignments = () => api<SkillAssignment[]>("/api/skill-assignments");

export const createAssignment = (body: {
  skill_id: string;
  grade?: string | null;
  section?: string | null;
  subject?: string | null;
}) => api<SkillAssignment>("/api/skill-assignments", { method: "POST", body });

export const deleteAssignment = (id: string) =>
  api<{ ok: true }>(`/api/skill-assignments/${id}`, { method: "DELETE" });
