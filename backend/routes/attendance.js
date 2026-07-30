import { Router } from "express";
import { withTenant } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

const router = Router();

// Attendance is queried by date or by student. We expose two read shapes.

// GET /api/attendance?date=YYYY-MM-DD&grade=...&section=...
// → list one row per student with their attendance status for that date.
router.get("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const { date, grade, section } = req.query;

    if (date) {
      const params = [cur.id, date];
      let extra = "";
      if (grade)   { params.push(grade);   extra += ` AND s.grade = $${params.length}`; }
      if (section) { params.push(section); extra += ` AND s.section = $${params.length}`; }
      const r = await withTenant(cur.id, (db) => db.query(
        `SELECT s.id AS student_id, s.first_name, s.last_name, s.student_id AS code,
                s.grade, s.section,
                a.id AS attendance_id, a.status, a.notes
           FROM students s
           LEFT JOIN attendance a
             ON a.student_id = s.id AND a.date = $2 AND a.account_id = $1
          WHERE s.account_id = $1${extra}
          ORDER BY s.grade, s.section, s.last_name`,
        params
      ));
      return res.json(r.rows);
    }

    // Default: recent attendance log (last 50)
    const r = await withTenant(cur.id, (db) => db.query(
      `SELECT a.id, a.date, a.status, a.notes,
              s.first_name, s.last_name, s.grade, s.section, s.student_id AS code
         FROM attendance a
         JOIN students s ON s.id = a.student_id
        WHERE a.account_id = $1
        ORDER BY a.date DESC, s.last_name
        LIMIT 50`,
      [cur.id]
    ));
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/attendance", err);
  }
});

// PUT /api/attendance — upsert one student's status for a date.
// body: { student_id, date, status, notes }
//
// SECURITY: must verify the student belongs to the calling teacher
// BEFORE the upsert. Without this check, an attacker who knows another
// teacher's student_id could call PUT and the ON CONFLICT UPDATE would
// rewrite account_id = EXCLUDED.account_id, hijacking the attendance
// record. We also DROPPED the `account_id = EXCLUDED.account_id`
// clause from the conflict handler — attendance ownership should
// never move once written. If a record exists for (student_id, date),
// it implicitly belongs to that student's teacher; the WHERE clause
// on the UPDATE makes this explicit.
router.put("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const { student_id, date, status, notes } = req.body || {};
    if (!student_id || !date || !status) {
      return res.status(400).json({ error: "student_id, date, status required" });
    }
    if (!["Present", "Absent", "Late", "Excused"].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }
    // Ownership check and upsert share one transaction, so the student can't
    // be reassigned between the two — and both run under RLS.
    const { own, r } = await withTenant(cur.id, async (db) => {
      const own = await db.query(
        "SELECT 1 FROM students WHERE id = $1 AND account_id = $2",
        [student_id, cur.id]
      );
      if (own.rowCount === 0) return { own, r: null };
      const r = await db.query(
      `INSERT INTO attendance (account_id, student_id, date, status, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_id, date) DO UPDATE
         SET status = EXCLUDED.status,
             notes  = EXCLUDED.notes
         WHERE attendance.account_id = $1
       RETURNING id, account_id, student_id, date, status, notes`,
        [cur.id, student_id, date, status, notes ?? null]
      );
      return { own, r };
    });
    if (own.rowCount === 0) return res.status(404).json({ error: "Student not found" });
    if (r.rowCount === 0) {
      // The (student_id, date) row exists but belongs to a different
      // teacher (shouldn't be possible given the ownership check above,
      // but defence-in-depth: surface 409 instead of silently winning).
      return res.status(409).json({ error: "Attendance row already owned by another teacher." });
    }
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PUT /api/attendance", err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const r = await withTenant(cur.id, (db) => db.query(
      "DELETE FROM attendance WHERE id = $1 AND account_id = $2",
      [req.params.id, cur.id]
    ));
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "DELETE /api/attendance/:id", err);
  }
});

export default router;
