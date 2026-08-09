// =====================================================================
// /api/students — the teacher's roster
//
// A student is a row in `students`. It may or may not have a `users`
// row: teachers type in a register long before any of those children
// have an account, and users is FK'd to auth.users, so a student only
// becomes a user when they accept an invitation.
//
// A teacher sees a student if they created them OR if the student is in
// one of their classes — which is how a student added by a colleague
// becomes visible once they are enrolled, without being owned twice.
// =====================================================================
import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { StudentSchema, StudentPatchSchema, validateBody } from "../lib/validate.js";

const FIELDS = [
  "first_name", "last_name", "student_id", "date_of_birth", "gender",
  "grade", "division", "email", "phone", "nationality", "address",
  "primary_guardian_name", "primary_guardian_relationship",
  "primary_guardian_email", "primary_guardian_phone",
  "secondary_guardian_name", "secondary_guardian_relationship",
  "secondary_guardian_email", "secondary_guardian_phone",
  "enrollment_date", "notes", "school_id",
];

// `section` is what the studio calls it and `division` is the column.
// Translated at the edge so neither side has to change.
const SELECT = `s.id, s.student_code, s.first_name, s.last_name, s.student_id,
  s.date_of_birth, s.gender, s.grade, s.division AS section, s.email, s.phone,
  s.nationality, s.address,
  s.primary_guardian_name, s.primary_guardian_relationship,
  s.primary_guardian_email, s.primary_guardian_phone,
  s.secondary_guardian_name, s.secondary_guardian_relationship,
  s.secondary_guardian_email, s.secondary_guardian_phone,
  s.enrollment_date, s.notes, s.school_id, s.user_id,
  s.created_at, s.updated_at`;

const inbound = (body = {}) => {
  const out = { ...body };
  if ("section" in out) { out.division = out.section; delete out.section; }
  return out;
};

// Visible to me: mine, or in one of my classes.
const VISIBLE = `(
  s.created_by = $1
  OR EXISTS (SELECT 1 FROM class_members cm JOIN classes c ON c.id = cm.class_id
              WHERE cm.student_id = s.id AND c.faculty_id = $1)
)`;

const router = Router();

/**
 * A school_id on a student must be one the teacher actually works at.
 * Not a cross-tenant write, but without it the per-school filter would
 * list a student under a school the teacher has no connection to.
 */
const assertOwnsSchool = async (req, res, next) => {
  try {
    const schoolId = (req.body || {}).school_id;
    if (!schoolId) return next();
    const r = await pool.query(
      `SELECT 1 FROM faculty_schools WHERE faculty_id = $1 AND school_id = $2
        UNION ALL
       SELECT 1 FROM faculty WHERE id = $1 AND school_id = $2`,
      [req.account.id, schoolId]
    );
    if (r.rowCount === 0) {
      return res.status(400).json({
        error: "school_id must be one of your schools. Add it under Settings → My schools first.",
      });
    }
    next();
  } catch (err) { handleErr(res, "students.assertOwnsSchool", err); }
};

router.get("/", async (req, res) => {
  try {
    const params = [req.account.id];
    let extra = "";
    if (req.query.class_id) {
      params.push(req.query.class_id);
      extra = ` AND EXISTS (SELECT 1 FROM class_members cm2
                             WHERE cm2.student_id = s.id AND cm2.class_id = $${params.length})`;
    }
    const r = await pool.query(
      `SELECT ${SELECT} FROM students s
        WHERE ${VISIBLE}${extra}
        ORDER BY s.grade, s.division, s.last_name, s.first_name`,
      params
    );
    res.json(r.rows);
  } catch (err) { handleErr(res, "GET /api/students", err); }
});

router.get("/:id", async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT ${SELECT} FROM students s WHERE s.id = $2::uuid AND ${VISIBLE}`,
      [req.account.id, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (err) { handleErr(res, "GET /api/students/:id", err); }
});

router.post("/", validateBody(StudentSchema), assertOwnsSchool, async (req, res) => {
  try {
    const body = inbound(req.body);
    const cols = FIELDS.map((f) => (f === "section" ? "division" : f)).filter((f) => f in body);
    const params = cols.map((c) => body[c]);
    params.push(req.account.id);
    const r = await pool.query(
      `INSERT INTO students (${cols.join(", ")}${cols.length ? ", " : ""}created_by)
       VALUES (${params.map((_, i) => `$${i + 1}`).join(", ")})
       RETURNING ${SELECT.replace(/\bs\./g, "")}`,
      params
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { handleErr(res, "POST /api/students", err); }
});

router.patch("/:id", validateBody(StudentPatchSchema), assertOwnsSchool, async (req, res) => {
  try {
    const body = inbound(req.body);
    const cols = FIELDS.map((f) => (f === "section" ? "division" : f)).filter((f) => f in body);
    if (!cols.length) return res.status(400).json({ error: "No fields" });

    // $1 is the faculty id because VISIBLE names it twice, and a
    // positional rewrite of an already-written clause only replaces the
    // first occurrence — which silently bound a phone number as a uuid.
    // Building the parameter list around the fixed placeholder instead
    // means there is nothing to rewrite.
    const params = [req.account.id];
    const sets = cols.map((c) => {
      params.push(body[c]);
      return `${c} = $${params.length}`;
    });
    params.push(req.params.id);
    const r = await pool.query(
      `UPDATE students s SET ${sets.join(", ")}, updated_at = now()
        WHERE s.id = $${params.length}::uuid AND ${VISIBLE}
        RETURNING ${SELECT}`,
      params
    );
    if (!r.rowCount) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (err) { handleErr(res, "PATCH /api/students/:id", err); }
});

// Only the creator may delete. Being able to see a student through a
// shared class is not the same as being able to remove them from the
// school's records — that would let one teacher erase another's roster.
router.delete("/:id", async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM students WHERE id = $1::uuid AND created_by = $2`,
      [req.params.id, req.account.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) { handleErr(res, "DELETE /api/students/:id", err); }
});

export default router;
