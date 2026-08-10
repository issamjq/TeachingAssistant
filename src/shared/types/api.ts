// API request/response types, inferred from the backend's zod schemas.
//
// shared/validation.ts defines the authoritative shape of every write.
// Re-declaring those shapes by hand would create two sources of truth
// that drift silently — the exact failure the duplicated role catalog
// already demonstrated (see shared/types/domain.ts).
//
// So they are inferred from the schemas themselves: add a field to
// StudentSchema and every call site that builds a student is a compile
// error until it is updated.

import type { z } from "zod";
import type * as Schemas from "@/shared/validation";

// ── Auth ─────────────────────────────────────────────────────────────
export type SupabaseBootstrapInput = z.infer<
  typeof Schemas.SupabaseBootstrapSchema
>;
export type RenewInput = z.infer<typeof Schemas.RenewSchema>;

// ── Schools ──────────────────────────────────────────────────────────
export type CreateSchoolInput = z.infer<typeof Schemas.CreateSchoolSchema>;
export type AttachSchoolInput = z.infer<typeof Schemas.AttachSchoolSchema>;
export type SetPrimaryInput = z.infer<typeof Schemas.SetPrimarySchema>;
export type SchoolMinePatchInput = z.infer<
  typeof Schemas.SchoolMinePatchSchema
>;

// ── Students ─────────────────────────────────────────────────────────
export type StudentInput = z.infer<typeof Schemas.StudentSchema>;
export type StudentPatchInput = z.infer<typeof Schemas.StudentPatchSchema>;

// ── Profile (/api/me) ────────────────────────────────────────────────
export type ProfilePatchInput = z.infer<typeof Schemas.ProfilePatchSchema>;
