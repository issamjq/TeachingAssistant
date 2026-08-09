// =====================================================================
// Generated work, as one table pretending to be five
//
// Lesson plans, quizzes, presentations, homework and activities used to
// be five tables with five column lists. They are one table now —
// ai_studio, discriminated by `type`, with the body in a jsonb `content`
// column — which is the right call: they are all "a thing the studio
// produced", they all carry the same provenance (model, tokens, the
// prompt that made them), and a new kind of output should not need a
// migration.
//
// What it costs is that a column list is now a jsonb key list, and the
// studio's screens are written against columns. This module pays that
// cost in one place: declare the flat fields a kind has, and it produces
// the same router surface crudRouter does — list, trash, get, post,
// patch, delete, restore, forever — flattening `content` on the way out
// and folding it back on the way in.
//
// So routes/drafts.js stays a short declaration rather than becoming a
// file full of `content->>'objectives'`.
// =====================================================================
import { Router } from "express";
import { pool } from "./db.js";
import { handleErr } from "./helpers.js";
import { validateBody } from "./validate.js";

// Columns that are really columns. Everything else a caller names is a
// key inside content — and `status` being real is why it can be filtered
// and indexed while `subject` cannot.
const REAL = new Set(["id", "type", "status", "faculty_id", "created_at", "updated_at", "deleted_at",
                      "model_used", "tokens_in", "tokens_out", "skill_id", "batch_id",
                      "prompt_text", "prompt_audio_path", "material_ids"]);

/**
 * A row as the studio expects it: real columns at the top level, the
 * jsonb body spread out beside them.
 *
 * content wins over nothing — a key that is absent stays absent rather
 * than becoming null — so a screen can tell "never set" from "set to
 * empty", which matters for a half-written lesson plan.
 */
const flatten = (row, fields) => {
  if (!row) return row;
  const { content, ...rest } = row;
  const out = { ...rest };
  for (const f of fields) out[f] = content?.[f] ?? null;
  // `name` and `title` are the same idea under two names across the old
  // tables. Serve both so neither screen has to be edited to find it.
  if (out.name == null && content?.title != null) out.name = content.title;
  if (out.title == null && content?.name != null) out.title = content.name;
  out.last_edited = rest.updated_at;
  return out;
};

/** Split an incoming body into real columns and content keys. */
const split = (body, fields) => {
  const cols = {};
  const content = {};
  for (const [k, v] of Object.entries(body || {})) {
    if (REAL.has(k)) cols[k] = v;
    else if (fields.includes(k)) content[k] = v;
    // Anything else is dropped: an unknown key is a client bug or an
    // attempt, and silently storing it in jsonb makes both invisible.
  }
  return { cols, content };
};

export function artifactRouter({
  type,
  fields,
  routeName,
  listOrderBy = "updated_at DESC NULLS LAST",
  bodySchema = null,
  patchSchema = null,
}) {
  const router = Router();
  const tag = routeName || `/api/${type}`;
  const SELECT = `id, type, status, content, model_used, tokens_in, tokens_out,
                  created_at, updated_at, deleted_at`;
  const fid = (req) => req.account.id;

  const one = async (res, sql, params, fields_) => {
    const r = await pool.query(sql, params);
    if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
    return res.json(flatten(r.rows[0], fields_));
  };

  router.get("/", async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT ${SELECT} FROM ai_studio
          WHERE faculty_id = $1 AND type = $2 AND deleted_at IS NULL
          ORDER BY ${listOrderBy}`,
        [fid(req), type]
      );
      res.json(r.rows.map((x) => flatten(x, fields)));
    } catch (err) { handleErr(res, `GET ${tag}`, err); }
  });

  router.get("/trash", async (req, res) => {
    try {
      // Opportunistic purge, same 30-day window the old tables had, so a
      // teacher is never shown something as recoverable that is not.
      await pool.query(
        `DELETE FROM ai_studio
          WHERE faculty_id = $1 AND type = $2
            AND deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '30 days'`,
        [fid(req), type]
      );
      const r = await pool.query(
        `SELECT ${SELECT} FROM ai_studio
          WHERE faculty_id = $1 AND type = $2 AND deleted_at IS NOT NULL
          ORDER BY deleted_at DESC`,
        [fid(req), type]
      );
      res.json(r.rows.map((x) => flatten(x, fields)));
    } catch (err) { handleErr(res, `GET ${tag}/trash`, err); }
  });

  router.post("/", ...(bodySchema ? [validateBody(bodySchema)] : []), async (req, res) => {
    try {
      const { cols, content } = split(req.body, fields);
      const r = await pool.query(
        `INSERT INTO ai_studio (faculty_id, type, status, content)
         VALUES ($1, $2, COALESCE($3, 'complete'), $4::jsonb)
         RETURNING ${SELECT}`,
        [fid(req), type, cols.status ?? null, JSON.stringify(content)]
      );
      res.status(201).json(flatten(r.rows[0], fields));
    } catch (err) { handleErr(res, `POST ${tag}`, err); }
  });

  router.get("/:id", async (req, res) => {
    try {
      await one(res,
        `SELECT ${SELECT} FROM ai_studio
          WHERE id = $1::uuid AND faculty_id = $2 AND type = $3 AND deleted_at IS NULL`,
        [req.params.id, fid(req), type], fields);
    } catch (err) { handleErr(res, `GET ${tag}/:id`, err); }
  });

  router.patch("/:id", ...(patchSchema ? [validateBody(patchSchema)] : []), async (req, res) => {
    try {
      const { cols, content } = split(req.body, fields);
      if (!Object.keys(content).length && cols.status === undefined) {
        return res.status(400).json({ error: "No fields" });
      }
      // Merge, not replace: PATCH on a jsonb body must leave the keys it
      // did not mention alone, which `||` does and an assignment does not.
      await one(res,
        `UPDATE ai_studio
            SET content = COALESCE(content, '{}'::jsonb) || $1::jsonb,
                status  = COALESCE($2, status),
                updated_at = now()
          WHERE id = $3::uuid AND faculty_id = $4 AND type = $5 AND deleted_at IS NULL
          RETURNING ${SELECT}`,
        [JSON.stringify(content), cols.status ?? null, req.params.id, fid(req), type], fields);
    } catch (err) { handleErr(res, `PATCH ${tag}/:id`, err); }
  });

  router.post("/:id/restore", async (req, res) => {
    try {
      await one(res,
        `UPDATE ai_studio SET deleted_at = NULL, updated_at = now()
          WHERE id = $1::uuid AND faculty_id = $2 AND type = $3 AND deleted_at IS NOT NULL
          RETURNING ${SELECT}`,
        [req.params.id, fid(req), type], fields);
    } catch (err) { handleErr(res, `POST ${tag}/:id/restore`, err); }
  });

  router.delete("/:id/forever", async (req, res) => {
    try {
      const r = await pool.query(
        `DELETE FROM ai_studio WHERE id = $1::uuid AND faculty_id = $2 AND type = $3`,
        [req.params.id, fid(req), type]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err) { handleErr(res, `DELETE ${tag}/:id/forever`, err); }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE ai_studio SET deleted_at = now(), updated_at = now()
          WHERE id = $1::uuid AND faculty_id = $2 AND type = $3 AND deleted_at IS NULL`,
        [req.params.id, fid(req), type]
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err) { handleErr(res, `DELETE ${tag}/:id`, err); }
  });

  return router;
}

export { flatten as flattenArtifact };
