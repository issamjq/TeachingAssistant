// =====================================================================
// /api/attendance — the register
//
// Two read shapes, both scoped to the teacher: by date (one row per
// student, marked or not) and by student (their history). The register
// must list every student whether or not they have been marked, so the
// join runs students LEFT JOIN attendance and never the other way round.
// =====================================================================
import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";

const router = Router();

// Students this teacher can mark: ones they added, or ones in their
// classes. Same rule as /api/students, so the register and the roster
// can never disagree about who is in the room.
const VISIBLE = `(
  s.created_by = $1
  OR EXISTS (SELECT 1 FROM class_members cm JOIN classes c ON c.id = cm.class_id
              WHERE cm.student_id = s.id AND c.faculty_id = $1)
)`;

router.get("/", async (req, res) => {
  try {
    const fid = req.account.id;
    const { date, grade, section, student_id } = req.query;

    if (student_id) {
      const r = await pool.query(
        `SELECT a.id, a.date, a.status, a.note AS notes, a.class_id, a.schedule_id
           FROM attendance a
          WHERE a.faculty_id = $1 AND a.student_id = $2::uuid
          ORDER BY a.date DESC
          LIMIT 200`,
        [fid, student_id]
      );
      return res.json(r.rows);
    }

    if (!date) return res.status(400).json({ error: "date or student_id is required" });

    const params = [fid, date];
    let extra = "";
    if (grade)   { params.push(grade);   extra += ` AND s.grade = $${params.length}`; }
    if (section) { params.push(section); extra += ` AND s.division = $${params.length}`; }

    const r = await pool.query(
      `SELECT s.id AS student_id, s.first_name, s.last_name, s.student_id AS code,
              s.grade, s.division AS section,
              a.id AS attendance_id, a.status, a.note AS notes
         FROM students s
         LEFT JOIN attendance a
                ON a.student_id = s.id AND a.date = $2::date AND a.faculty_id = $1
        WHERE ${VISIBLE}${extra}
        ORDER BY s.grade, s.division, s.last_name, s.first_name`,
      params
    );
    res.json(r.rows);
  } catch (err) { handleErr(res, "GET /api/attendance", err); }
});

// PUT one student's mark for one day. Idempotent: taking the register
// twice corrects it rather than doubling it — see the partial unique
// indexes on (student, date [, session]).
router.put("/:studentId", async (req, res) => {
  try {
    const fid = req.account.id;
    const { date, status, notes, class_id, schedule_id } = req.body || {};
    if (!date)   return res.status(400).json({ error: "date is required" });
    if (!status) return res.status(400).json({ error: "status is required" });

    const seen = await pool.query(
      `SELECT 1 FROM students s WHERE s.id = $2::uuid AND ${VISIBLE}`,
      [fid, req.params.studentId]
    );
    if (!seen.rowCount) return res.status(404).json({ error: "Student not found" });

    const conflict = schedule_id
      ? "(student_id, date, schedule_id) WHERE schedule_id IS NOT NULL"
      : "(student_id, date) WHERE schedule_id IS NULL";
    const r = await pool.query(
      `INSERT INTO attendance (faculty_id, student_id, class_id, schedule_id, date, status, note)
       VALUES ($1, $2::uuid, $3, $4, $5::date, $6, $7)
       ON CONFLICT ${conflict} DO UPDATE
         SET status = EXCLUDED.status, note = EXCLUDED.note,
             class_id = COALESCE(EXCLUDED.class_id, attendance.class_id),
             updated_at = now()
       RETURNING id, student_id, date, status, note AS notes, class_id, schedule_id`,
      [fid, req.params.studentId, class_id || null, schedule_id || null, date, status, notes || null]
    );
    res.json(r.rows[0]);
  } catch (err) { handleErr(res, "PUT /api/attendance/:studentId", err); }
});

export default router;
