import { Router } from "express";
import { pool } from "../lib/db.js";
import { buildPatch, handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher, setCurrentTeacher } from "../lib/currentTeacher.js";

const ME_SELECT = `id, first_name, last_name, email, phone, staff_id, majors, grade_levels,
                   languages, sections, class_map, nationality, hire_date, bio,
                   created_at, updated_at`;

const ME_FIELDS = [
  "first_name", "last_name", "email", "phone", "staff_id",
  "majors", "grade_levels", "languages", "sections", "class_map",
  "nationality", "hire_date", "bio",
];

const router = Router();

router.get("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found in DB" });
    const r = await pool.query(`SELECT ${ME_SELECT} FROM teachers WHERE id = $1`, [cur.id]);
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "GET /api/me", err);
  }
});

router.patch("/", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found in DB" });

    // class_map is jsonb — node-postgres turns a JS array into a Postgres
    // ARRAY literal which jsonb rejects ("invalid input syntax for type
    // json"), so stringify it. majors/grade_levels/languages/sections are
    // TEXT[] and must stay as arrays, so they are left untouched.
    const body = { ...(req.body || {}) };
    if (
      Object.prototype.hasOwnProperty.call(body, "class_map") &&
      body.class_map !== null &&
      typeof body.class_map !== "string"
    ) {
      body.class_map = JSON.stringify(body.class_map);
    }

    const { sets, params } = buildPatch(body, ME_FIELDS);
    if (sets.length === 0) {
      const r = await pool.query(`SELECT ${ME_SELECT} FROM teachers WHERE id = $1`, [cur.id]);
      return res.json(r.rows[0]);
    }
    params.push(cur.id);
    const upd = await pool.query(
      `UPDATE teachers SET ${sets.join(", ")}, updated_at = NOW()
        WHERE id = $${params.length}
        RETURNING ${ME_SELECT}`,
      params
    );
    setCurrentTeacher({ id: upd.rows[0].id, grade_levels: upd.rows[0].grade_levels || [] });
    res.json(upd.rows[0]);
  } catch (err) {
    handleErr(res, "PATCH /api/me", err);
  }
});

export default router;
