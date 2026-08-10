// =====================================================================
// Request shapes, as zod schemas
//
// These were the API's input validation. With the API gone and the
// browser writing to Postgres directly, they moved here — and they
// matter more, not less: there is no longer a server to reject a
// malformed body before it reaches a table.
//
// What they are NOT is the security boundary. That is RLS and the CHECK
// constraints, both of which hold whatever the client sends. These
// schemas exist to catch a mistake early and to give a teacher a useful
// message instead of a Postgres error — and to give shared/types/api.ts
// something to infer from, so a field added here is a compile error at
// every call site that builds one of these objects.
// =====================================================================
import { z } from "zod";

// ── Reusable primitives ────────────────────────────────────────────────
const safeShortText  = z.string().trim().max(200);
const safeLongText   = z.string().trim().max(2000);
const safeBio        = z.string().trim().max(1000);
const safePhone      = z.string().trim().max(40).regex(/^[+0-9 \-().]*$/, "Invalid phone format");
const safeEmail      = z.string().trim().email().max(254);
// A provider's profile photo. https only and length-capped: an avatar URL
// is rendered straight into a background-image, so a javascript: or data:
// value here would be a stored-XSS foothold rather than a broken picture.
const safePhotoUrl   = z.string().trim().max(1000).refine(
  (v) => /^https:\/\//i.test(v),
  "Avatar URL must be https"
);
const isoDate        = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD expected");

// ── Auth ───────────────────────────────────────────────────────────────
export const SupabaseBootstrapSchema = z.object({
  plan: z.enum(["trial", "monthly", "quarterly", "annual"]).optional(),
}).strip();

export const RenewSchema = z.object({
  plan: z.enum(["monthly", "quarterly", "annual"]),
}).strip();

// ── Schools ────────────────────────────────────────────────────────────
const EMIRATES = [
  "Abu Dhabi", "Dubai", "Sharjah", "Ajman",
  "Umm Al Quwain", "Ras Al Khaimah", "Fujairah",
];
const SCHOOL_TYPES = ["Public", "Private"];
const SCHOOL_CURRICULA = ["MOE", "British", "American", "IB", "Indian", "French", "Other"];

export const CreateSchoolSchema = z.object({
  name:       safeShortText.min(2),
  name_ar:    safeShortText.optional().nullable(),
  emirate:    z.enum(EMIRATES),
  city:       safeShortText.optional().nullable(),
  type:       z.enum(SCHOOL_TYPES).optional().nullable(),
  curriculum: z.enum(SCHOOL_CURRICULA).optional().nullable(),
  website:    z.string().url().max(500).optional().nullable(),
}).strip();

export const AttachSchoolSchema = z.object({
  school_id:  z.number().int().positive(),
  is_primary: z.boolean().optional(),
  grade_sections: z.record(
    z.string().max(80),
    z.array(safeShortText).max(40)
  ).optional(),
}).strip();

export const SetPrimarySchema = z.object({
  is_primary: z.boolean(),
}).strip();

// PATCH /api/schools/mine/:id — flip primary AND/OR set per-school
// grade_sections. Both optional, both validated strictly.
export const SchoolMinePatchSchema = z.object({
  is_primary: z.boolean().optional(),
  grade_sections: z.record(
    z.string().max(80),
    z.array(safeShortText).max(40)
  ).optional(),
}).strip().refine(
  (v) => v.is_primary !== undefined || v.grade_sections !== undefined,
  { message: "Body must include is_primary or grade_sections." }
);

// ── Students ───────────────────────────────────────────────────────────
const GENDERS = ["Male", "Female", "Other"];

export const StudentSchema = z.object({
  first_name:                     safeShortText.min(1),
  last_name:                      safeShortText.min(1),
  student_id:                     safeShortText.optional().nullable(),
  date_of_birth:                  isoDate.optional().nullable(),
  gender:                         z.enum(GENDERS).optional().nullable(),
  grade:                          safeShortText.min(1),
  section:                        safeShortText.min(1),
  email:                          safeEmail.optional().nullable(),
  phone:                          safePhone.optional().nullable(),
  nationality:                    safeShortText.optional().nullable(),
  address:                        safeShortText.optional().nullable(),
  primary_guardian_name:          safeShortText.optional().nullable(),
  primary_guardian_relationship:  safeShortText.optional().nullable(),
  primary_guardian_email:         safeEmail.optional().nullable(),
  primary_guardian_phone:         safePhone.optional().nullable(),
  secondary_guardian_name:        safeShortText.optional().nullable(),
  secondary_guardian_relationship:safeShortText.optional().nullable(),
  secondary_guardian_email:       safeEmail.optional().nullable(),
  secondary_guardian_phone:       safePhone.optional().nullable(),
  enrollment_date:                isoDate.optional().nullable(),
  notes:                          safeBio.optional().nullable(),
  school_id:                      z.number().int().positive().optional().nullable(),
}).strip();

// PATCH variant — everything optional.
export const StudentPatchSchema = StudentSchema.partial();

// ── /api/me ────────────────────────────────────────────────────────────
export const ProfilePatchSchema = z.object({
  first_name:    safeShortText.optional(),
  last_name:     safeShortText.optional(),
  email:         safeEmail.optional(),
  phone:         safePhone.optional().nullable(),
  staff_id:      safeShortText.optional(),
  avatar_url:    safePhotoUrl.optional().nullable(),
  majors:        z.array(safeShortText).max(40).optional(),
  grade_levels:  z.array(safeShortText).max(40).optional(),
  languages:     z.array(safeShortText).max(40).optional(),
  sections:      z.array(safeShortText).max(40).optional(),
  class_map:     z.array(z.object({
    major:    safeShortText.optional(),
    grades:   z.array(safeShortText).max(40).optional(),
    sections: z.array(safeShortText).max(40).optional(),
  })).max(40).optional(),
  // Per-grade sections: { "Grade 3": ["Section A", "Section B"] }.
  // record() validates that keys are strings (any) and values are
  // capped arrays of short strings.
  grade_sections: z.record(
    z.string().max(80),
    z.array(safeShortText).max(40)
  ).optional(),
  nationality:   safeShortText.optional().nullable(),
  hire_date:     isoDate.optional().nullable(),
  bio:           safeBio.optional().nullable(),
}).strip();

// ── Middleware factory ─────────────────────────────────────────────────
