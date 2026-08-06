// API request/response types, inferred from the backend's zod schemas.
//
// backend/lib/validate.js already defines the authoritative shape of every
// request body. Re-declaring those shapes by hand on the frontend would
// create two sources of truth that drift silently — the exact failure the
// duplicated role catalog already demonstrated (see shared/types/domain.ts).
//
// Instead we infer from the schemas themselves. Add a field to
// StudentSchema on the server and every frontend call site that builds a
// student is a compile error until it's updated.
//
// `import type` is fully erased at compile time, so NO backend code reaches
// the browser bundle — this costs nothing at runtime. It works because
// tsconfig has allowJs, letting TypeScript read types out of the .js source.

import type { z } from "zod";
import type * as Schemas from "@backend/lib/validate";

// ── Auth ─────────────────────────────────────────────────────────────
export type FirebaseBootstrapInput = z.infer<
  typeof Schemas.FirebaseBootstrapSchema
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
