import { Router } from "express";
import { crudRouter } from "../lib/crud.js";
import { StudentSchema, StudentPatchSchema } from "../lib/validate.js";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

const FIELDS = [
  "first_name", "last_name", "student_id", "date_of_birth", "gender",
  "grade", "section", "email", "phone", "nationality", "address",
  "primary_guardian_name", "primary_guardian_relationship",
  "primary_guardian_email", "primary_guardian_phone",
  "secondary_guardian_name", "secondary_guardian_relationship",
  "secondary_guardian_email", "secondary_guardian_phone",
  "enrollment_date", "notes", "school_id",
];

const SELECT = `id, first_name, last_name, student_id, date_of_birth, gender,
  grade, section, email, phone, nationality, address,
  primary_guardian_name, primary_guardian_relationship,
  primary_guardian_email, primary_guardian_phone,
  secondary_guardian_name, secondary_guardian_relationship,
  secondary_guardian_email, secondary_guardian_phone,
  enrollment_date, notes, school_id, created_at, updated_at`;

// Students belong to the teacher who created them. teacherScoped takes care
// of all four endpoints (list / get / create / update / delete). The legacy
// `?teacher=me` query parameter is now a no-op and intentionally ignored —
// every list call already returns only the current teacher's students.
// SECURITY: when a student row carries a school_id, verify the
// referenced school is one the calling teacher actually works at.
// Without this guard, a teacher could attach their students to ANY
// catalog school (not a cross-tenant write, but a data-integrity
// problem — the studio's per-school filter would then surface a
// student under a school the teacher isn't actually linked to).
// Mounted BEFORE the crud subrouter so it runs first; null/missing
// school_id passes through untouched.
const assertOwnsSchoolIfPresent = async (req, res, next) => {
  try {
    const schoolId = (req.body || {}).school_id;
    if (schoolId === null || schoolId === undefined || schoolId === "") return next();
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(401).json({ error: "Not authenticated" });
    const r = await pool.query(
      "SELECT 1 FROM teacher_schools WHERE teacher_id = $1 AND school_id = $2",
      [cur.id, schoolId]
    );
    if (r.rowCount === 0) {
      return res.status(400).json({
        error: "school_id must be one of your schools. Add it under Settings → My schools first.",
      });
    }
    next();
  } catch (err) {
    handleErr(res, "students.assertOwnsSchoolIfPresent", err);
  }
};

const router = Router();
router.post("/",     assertOwnsSchoolIfPresent);
router.patch("/:id", assertOwnsSchoolIfPresent);
router.use("/", crudRouter({
  table: "students",
  fields: FIELDS,
  selectCols: SELECT,
  listOrderBy: "grade, section, last_name, first_name",
  timestampOnPatch: "updated_at",
  routeName: "/api/students",
  teacherScoped: true,
  bodySchema: StudentSchema,
  patchSchema: StudentPatchSchema,
}));
export default router;
