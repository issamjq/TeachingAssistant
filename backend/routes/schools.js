import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { loadCurrentTeacher } from "../lib/currentTeacher.js";
import { CreateSchoolSchema, AttachSchoolSchema, SchoolMinePatchSchema, validateBody } from "../lib/validate.js";
import { recordAudit } from "../lib/audit.js";
import { clientIp, userAgent } from "../lib/auth.js";

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
// duplicates. No auth gate yet; tighten when scoping lands.
router.post("/", validateBody(CreateSchoolSchema), async (req, res) => {
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
      `SELECT ${SCHOOL_COLS_S}, ts.is_primary, ts.grade_sections
         FROM account_schools ts
         JOIN schools s ON s.id = ts.school_id
        WHERE ts.account_id = $1
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
router.post("/mine", validateBody(AttachSchoolSchema), async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found" });
    const { school_id, is_primary, grade_sections } = req.body;

    // SECURITY: verify the catalog row exists before attaching. Without
    // this, a forged school_id would create an orphan FK row that no
    // existing constraint catches (FK to schools(id) does, but better
    // to fail loud with 404 than to surface a 500 from a constraint).
    const sch = await pool.query("SELECT 1 FROM schools WHERE id = $1", [school_id]);
    if (sch.rowCount === 0) return res.status(404).json({ error: "School not found in catalog." });

    if (is_primary) {
      await pool.query(
        `UPDATE account_schools SET is_primary = FALSE WHERE account_id = $1`,
        [cur.id]
      );
    }
    const gsJson = grade_sections ? JSON.stringify(grade_sections) : "{}";
    await pool.query(
      `INSERT INTO account_schools (account_id, school_id, is_primary, grade_sections)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (account_id, school_id) DO UPDATE SET
         is_primary     = EXCLUDED.is_primary,
         grade_sections = EXCLUDED.grade_sections`,
      [cur.id, school_id, !!is_primary, gsJson]
    );
    const r = await pool.query(
      `SELECT ${SCHOOL_COLS_S}, ts.is_primary, ts.grade_sections
         FROM account_schools ts JOIN schools s ON s.id = ts.school_id
        WHERE ts.account_id = $1 AND ts.school_id = $2`,
      [cur.id, school_id]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    handleErr(res, "POST /api/schools/mine", err);
  }
});

// Flip the primary flag AND/OR update per-school grade_sections for
// one of the teacher's schools. Both fields are optional; at least
// one must be present (enforced by SchoolMinePatchSchema).
//
// SECURITY: the WHERE clause is hard-scoped by account_id so a teacher
// can only edit their own row. No cross-tenant write is possible
// even if school_id is forged. The grade_sections payload was already
// passed through a strict zod schema (record<string, string[]>,
// per-row max sizes) so a giant or oddly-shaped JSONB can't land in
// the DB. The DB-level CHECK (jsonb_typeof = 'object') is the last
// line of defence.
router.patch("/mine/:id", validateBody(SchoolMinePatchSchema), async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found" });
    const schoolId = Number(req.params.id);
    if (!Number.isInteger(schoolId) || schoolId < 1) {
      return res.status(400).json({ error: "Invalid school id." });
    }
    const { is_primary, grade_sections } = req.body;

    // If flipping to primary, demote any existing primary first. We
    // do this in the same transaction as the patch so a request that
    // claims primary AND fails partway can't leave the teacher with
    // zero primaries.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (is_primary === true) {
        await client.query(
          `UPDATE account_schools SET is_primary = FALSE WHERE account_id = $1`,
          [cur.id]
        );
      }
      const sets = [];
      const params = [cur.id, schoolId];
      if (is_primary !== undefined) {
        params.push(is_primary);
        sets.push(`is_primary = $${params.length}`);
      }
      if (grade_sections !== undefined) {
        params.push(JSON.stringify(grade_sections));
        sets.push(`grade_sections = $${params.length}::jsonb`);
      }
      const r = await client.query(
        `UPDATE account_schools SET ${sets.join(", ")}
           WHERE account_id = $1 AND school_id = $2
           RETURNING is_primary, grade_sections, school_id`,
        params
      );
      if (r.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Not found" });
      }
      await client.query("COMMIT");
      res.json(r.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    handleErr(res, "PATCH /api/schools/mine/:id", err);
  }
});

// Remove a school from the teacher. Students that pointed at it keep
// pointing (FK is ON DELETE SET NULL at the catalog level, but here we
// only remove the account_schools row — the student.school_id stays
// intact since the catalog row still exists).
router.delete("/mine/:id", async (req, res) => {
  try {
    const cur = await loadCurrentTeacher(req);
    if (!cur) return res.status(404).json({ error: "Current teacher not found" });
    const r = await pool.query(
      `DELETE FROM account_schools WHERE account_id = $1 AND school_id = $2`,
      [cur.id, req.params.id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    await recordAudit({
      accountId: cur.id,
      action: "school.remove",
      targetTable: "account_schools",
      targetId: Number(req.params.id),
      ip: clientIp(req), userAgent: userAgent(req),
    });
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "DELETE /api/schools/mine/:id", err);
  }
});

export default router;
