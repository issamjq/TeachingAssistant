// Input validation. zod gives us per-route schema enforcement; this
// module wires schemas to Express middleware so a route can declare
//
//   router.post("/x", validateBody(SomeSchema), handler)
//
// and unknown / over-long / wrong-type fields are rejected with a
// 400 before the handler runs. The handler can trust req.validated.
//
// We deliberately use `.strip()` so unknown fields are silently
// removed (not rejected) — keeps the API tolerant of a frontend that
// sends a few extra keys, while still preventing them from reaching
// the SQL layer.
import { z } from "zod";

// ── Reusable primitives ────────────────────────────────────────────────
const safeShortText  = z.string().trim().max(200);
const safeLongText   = z.string().trim().max(2000);
const safeBio        = z.string().trim().max(1000);
const safePhone      = z.string().trim().max(40).regex(/^[+0-9 \-().]*$/, "Invalid phone format");
const safeEmail      = z.string().trim().email().max(254);
const isoDate        = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD expected");

// ── Auth ───────────────────────────────────────────────────────────────
export const FirebaseBootstrapSchema = z.object({
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
}).strip();

export const SetPrimarySchema = z.object({
  is_primary: z.boolean(),
}).strip();

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
export function validateBody(schema) {
  return (req, res, next) => {
    const r = schema.safeParse(req.body || {});
    if (!r.success) {
      // Strip the zod machinery; surface a flat list the frontend can
      // map onto inputs without exposing schema internals.
      const issues = r.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return res.status(400).json({ error: "Invalid input.", issues });
    }
    req.validated = r.data;
    req.body = r.data; // legacy handlers read req.body
    next();
  };
}
