import { Router } from "express";
import { pool } from "../lib/db.js";
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
      const r = await pool.query(
        `SELECT s.id AS student_id, s.first_name, s.last_name, s.student_id AS code,
                s.grade, s.section,
                a.id AS attendance_id, a.status, a.notes
           FROM students s
           LEFT JOIN attendance a
             ON a.student_id = s.id AND a.date = $2 AND a.teacher_id = $1
          WHERE s.teacher_id = $1${extra}
          ORDER BY s.grade, s.section, s.last_name`,
        params
      );
      return res.json(r.rows);
    }

    // Default: recent attendance log (last 50)
    const r = await pool.query(
      `SELECT a.id, a.date, a.status, a.notes,
              s.first_name, s.last_name, s.grade, s.section, s.student_id AS code
         FROM attendance a
         JOIN students s ON s.id = a.student_id
        WHERE a.teacher_id = $1
        ORDER BY a.date DESC, s.last_name
        LIMIT 50`,
      [cur.id]
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/attendance", err);
  }
});

// PUT /api/attendance — upsert one student's status for a date.
// body: { student_id, date, status, notes }
router.put("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const { student_id, date, status, notes } = req.body || {};
    if (!student_id || !date || !status) {
      return res.status(400).json({ error: "student_id, date, status required" });
    }
    const r = await pool.query(
      `INSERT INTO attendance (teacher_id, student_id, date, status, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_id, date) DO UPDATE
         SET status = EXCLUDED.status, notes = EXCLUDED.notes, teacher_id = EXCLUDED.teacher_id
       RETURNING id, teacher_id, student_id, date, status, notes`,
      [cur.id, student_id, date, status, notes ?? null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PUT /api/attendance", err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    const r = await pool.query(
      "DELETE FROM attendance WHERE id = $1 AND teacher_id = $2",
      [req.params.id, cur.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "DELETE /api/attendance/:id", err);
  }
});

export default router;
