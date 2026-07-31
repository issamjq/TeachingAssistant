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
import {
  ANNOUNCEMENT_KINDS, ANNOUNCEMENT_PRIORITIES, ANNOUNCEMENT_AUDIENCES,
} from "../../src/lib/enums.js";

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

// ── Attendance + grades ────────────────────────────────────────────────
// These two carry data ABOUT A CHILD, so the input rules are tighter than
// elsewhere: every field is bounded, and the free-text ones especially — a
// note on an absence is the kind of field that ends up in front of a parent.
//
// Numbers are coerced rather than required-as-numbers: the forms post JSON
// numbers today, but a coerced schema means a future caller sending "85"
// gets a clean 85 instead of a 400 nobody can debug.
const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Excused"];

export const AttendanceUpsertSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  date:       isoDate,
  status:     z.enum(ATTENDANCE_STATUSES),
  notes:      safeLongText.optional().nullable(),
}).strip();

// score is NUMERIC in Postgres, so decimals are legitimate (7.5 / 10).
// max_score is an INT. Both are capped well above any real mark scheme to
// stop a typo or a hostile client writing an absurd value into a child's
// record — 10000 allows a 10,000-point scheme and rejects 1e9.
export const GradeSchema = z.object({
  student_id: z.coerce.number().int().positive(),
  subject:    safeShortText.min(1),
  term:       safeShortText.optional().nullable(),
  category:   safeShortText.optional().nullable(),
  score:      z.coerce.number().min(0).max(10000),
  max_score:  z.coerce.number().int().positive().max(10000).optional(),
  notes:      safeLongText.optional().nullable(),
}).strip();

export const GradePatchSchema = GradeSchema.partial();

// Bulk publish/unpublish. Capped at 500 ids: a teacher publishes a term for a
// class, not a database. The cap is what stops one request turning into an
// unbounded UPDATE.
export const GradePublishSchema = z.object({
  ids:       z.array(z.coerce.number().int().positive()).min(1).max(500),
  published: z.boolean(),
}).strip();

// ── Bulletin board ─────────────────────────────────────────────────────
// A note on this board can end up in front of a class, and later in front of
// their parents, so the body is bounded and the enums come from the same
// enums.js the CHECK constraints are compiled from — a value that passes zod
// but fails the constraint would be a 500 the teacher can do nothing about.
// The shape, before the cross-field rule. Kept separate so both the create
// and the patch schema can reuse it — a refined schema has no .partial().
const AnnouncementFields = z.object({
  title:      safeShortText.min(1),
  body:       z.string().trim().max(4000).optional().nullable(),
  kind:       z.enum(ANNOUNCEMENT_KINDS).optional(),
  priority:   z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
  audience:   z.enum(ANNOUNCEMENT_AUDIENCES).optional(),
  grade:      safeShortText.optional().nullable(),
  section:    safeShortText.optional().nullable(),
  pinned:     z.boolean().optional(),
  starts_on:  isoDate.optional().nullable(),
  expires_on: isoDate.optional().nullable(),
}).strip();

// A take-down date before the put-up date is a slip, and the CHECK constraint
// would reject it as a 500 the teacher can do nothing about. Catch it here and
// say which field is wrong.
const sameWindowRule = (v) => !v.starts_on || !v.expires_on || v.expires_on >= v.starts_on;
const windowMessage = {
  message: "The take-down date cannot be before the put-up date.",
  path: ["expires_on"],
};

export const AnnouncementSchema = AnnouncementFields.refine(sameWindowRule, windowMessage);
export const AnnouncementPatchSchema = AnnouncementFields.partial().refine(sameWindowRule, windowMessage);

export const AnnouncementPostSchema = z.object({
  ids:    z.array(z.coerce.number().int().positive()).min(1).max(200),
  posted: z.boolean(),
}).strip();

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
