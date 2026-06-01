import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";

// Two surfaces share this router:
//
//   /api/schools          — read-only UAE catalog (id, name_ar, emirate…)
//   /api/schools/mine     — current teacher's selected schools, including is_primary
//   POST /api/schools/mine                   { school_id, is_primary? }
//   PATCH /api/schools/mine/:id              { is_primary }
//   DELETE /api/schools/mine/:id
//
// The catalog grows infrequently and is small enough (~50 rows today,
// few hundred eventually) to return wholesale — no pagination yet.

const SCHOOL_COLS = `id, name, name_ar, emirate, city, type, curriculum, website`;
const SCHOOL_COLS_S = `s.id, s.name, s.name_ar, s.emirate, s.city, s.type, s.curriculum, s.website`;

const router = Router();

// Catalog. Optional ?emirate=Dubai filter for the picker.
router.get("/", async (req, res) => {
  try {
    const params = [];
    let where = "";
    if (req.query.emirate) {
      params.push(req.query.emirate);
      where = `WHERE emirate = $1`;
    }
    const r = await pool.query(
      `SELECT ${SCHOOL_COLS} FROM schools ${where} ORDER BY emirate, name`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/schools", err);
  }
});

// Catalog insert — used by the "school not listed?" fallback in
// onboarding + the My-schools tab. Returns the existing row if (name,
// emirate) already matches, so the client doesn't need to special-case
// duplicates. No auth gate yet; tighten when Firebase lands.
router.post("/", async (req, res) => {
  try {
    const { name, name_ar, emirate, city, type, curriculum, website } = req.body || {};
    if (!name || !emirate) {
      return res.status(400).json({ error: "name and emirate are required" });
    }
    const existing = await pool.query(
      `SELECT ${SCHOOL_COLS} FROM schools WHERE name = $1 AND emirate = $2`,
      [name, emirate]
    );
    if (existing.rows.length > 0) return res.json(existing.rows[0]);

    const r = await pool.query(
      `INSERT INTO schools (name, name_ar, emirate, city, type, curriculum, website)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SCHOOL_COLS}`,
      [name, name_ar || null, emirate, city || null, type || null, curriculum || null, website || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    handleErr(res, "POST /api/schools", err);
  }
});

// My schools — joined with the catalog so callers don't need a 2nd round trip.
router.get("/mine", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found" });
    const r = await pool.query(
      `SELECT ${SCHOOL_COLS_S}, ts.is_primary
         FROM teacher_schools ts
         JOIN schools s ON s.id = ts.school_id
        WHERE ts.teacher_id = $1
        ORDER BY ts.is_primary DESC, s.name`,
      [cur.id]
    );
    res.json(r.rows);
  } catch (err) {
    handleErr(res, "GET /api/schools/mine", err);
  }
});

// Add a school for the current teacher. If is_primary=true, demote any
// other primary first so there's at most one primary per teacher.
router.post("/mine", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found" });
    const { school_id, is_primary } = req.body || {};
    if (!school_id) return res.status(400).json({ error: "school_id required" });

    if (is_primary) {
      await pool.query(
        `UPDATE teacher_schools SET is_primary = FALSE WHERE teacher_id = $1`,
        [cur.id]
      );
    }
    await pool.query(
      `INSERT INTO teacher_schools (teacher_id, school_id, is_primary)
       VALUES ($1, $2, $3)
       ON CONFLICT (teacher_id, school_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
      [cur.id, school_id, !!is_primary]
    );
    const r = await pool.query(
      `SELECT ${SCHOOL_COLS_S}, ts.is_primary
         FROM teacher_schools ts JOIN schools s ON s.id = ts.school_id
        WHERE ts.teacher_id = $1 AND ts.school_id = $2`,
      [cur.id, school_id]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    handleErr(res, "POST /api/schools/mine", err);
  }
});

// Flip the primary flag for one of the teacher's schools.
router.patch("/mine/:id", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found" });
    const schoolId = req.params.id;
    const { is_primary } = req.body || {};
    if (typeof is_primary !== "boolean") {
      return res.status(400).json({ error: "is_primary boolean required" });
    }
    if (is_primary) {
      await pool.query(
        `UPDATE teacher_schools SET is_primary = FALSE WHERE teacher_id = $1`,
        [cur.id]
      );
    }
    const r = await pool.query(
      `UPDATE teacher_schools SET is_primary = $3
         WHERE teacher_id = $1 AND school_id = $2 RETURNING *`,
      [cur.id, schoolId, is_primary]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "PATCH /api/schools/mine/:id", err);
  }
});

// Remove a school from the teacher. Students that pointed at it keep
// pointing (FK is ON DELETE SET NULL at the catalog level, but here we
// only remove the teacher_schools row — the student.school_id stays
// intact since the catalog row still exists).
router.delete("/mine/:id", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found" });
    const r = await pool.query(
      `DELETE FROM teacher_schools WHERE teacher_id = $1 AND school_id = $2`,
      [cur.id, req.params.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "DELETE /api/schools/mine/:id", err);
  }
});

export default router;
