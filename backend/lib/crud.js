import { Router } from "express";
import { pool } from "./db.js";
import { buildPatch, handleErr } from "./helpers.js";
import { loadCurrentTeacher } from "./currentTeacher.js";
import { validateBody } from "./validate.js";

// Build a standard CRUD router for a single table.
//
//   table          : SQL table name
//   fields         : columns clients are allowed to set (used for INSERT / UPDATE)
//   selectCols     : columns to return (RETURNING + GET projection)
//   listOrderBy    : ORDER BY clause for the list endpoint (no leading "ORDER BY")
//   timestampOnPatch : column to set to NOW() on PATCH; pass null to skip.
//   teacherScoped  : if true, every endpoint scopes by current teacher's id
//                    (forbids cross-teacher reads, stamps account_id on inserts).
//   listExtra(req, ctx) : optional, returns { where, params, skip } extending the scope.
//   afterMutation(row)  : optional callback after each successful POST / PATCH.
//   softDelete     : if true, DELETE flips a deleted_at timestamp instead
//                    of removing the row. GETs hide soft-deleted rows.
//                    Adds /trash, /:id/restore, /:id/forever routes and
//                    auto-purges anything > 30 days old on /trash access.
//   jsonFields     : columns of type json/jsonb. node-postgres serializes
//                    a JS array as a Postgres ARRAY literal ('{...}'),
//                    which a jsonb column rejects ("invalid input syntax
//                    for type json"). We JSON.stringify these before bind
//                    so the column gets valid JSON. TEXT[] columns must
//                    NOT be listed here — they want the array literal.
export function crudRouter({
  table,
  fields,
  selectCols,
  listOrderBy,
  timestampOnPatch = "updated_at",
  routeName,
  teacherScoped = false,
  listExtra = null,
  afterMutation = null,
  softDelete = false,
  jsonFields = [],
  // Optional zod schemas. When provided, the POST / PATCH routes get a
  // validateBody() middleware that rejects unknown / oversized / wrong-
  // type fields before they reach the handler. Strongly recommended for
  // any table that accepts user-typed data (students, schools, …).
  bodySchema = null,
  patchSchema = null,
}) {
  const router = Router();
  const tag = routeName || `/api/${table}`;

  // Stringify json/jsonb fields so an array/object value lands as valid
  // JSON instead of a Postgres array literal. Strings and null pass
  // through untouched (already JSON, or an intentional SQL NULL).
  const coerceJson = (obj) => {
    if (!jsonFields.length || !obj) return obj;
    const out = { ...obj };
    for (const f of jsonFields) {
      if (
        Object.prototype.hasOwnProperty.call(out, f) &&
        out[f] !== null &&
        out[f] !== undefined &&
        typeof out[f] !== "string"
      ) {
        out[f] = JSON.stringify(out[f]);
      }
    }
    return out;
  };

  const scopeFor = async (req) => {
    if (!teacherScoped) return { where: "", params: [], teacherId: null };
    const cur = await loadCurrentTeacher(req);
    if (!cur) throw new Error("Current teacher not resolved (no STF-001 in DB?)");
    return { where: "account_id = $1", params: [cur.id], teacherId: cur.id };
  };

  router.get("/", async (req, res) => {
    try {
      const scope = await scopeFor(req);
      const baseConds = [];
      if (scope.where) baseConds.push(scope.where);
      if (softDelete) baseConds.push("deleted_at IS NULL");
      let where = baseConds.length ? `WHERE ${baseConds.join(" AND ")}` : "";
      let params = [...scope.params];

      if (listExtra) {
        const extra = await listExtra(req, { teacherId: scope.teacherId });
        if (extra?.skip) return res.json([]);
        if (extra?.where) {
          // Re-base extra's $N placeholders on top of current params length.
          const offset = params.length;
          const rebased = extra.where.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`);
          where = where ? `${where} AND ${rebased}` : `WHERE ${rebased}`;
          params = [...params, ...(extra.params || [])];
        }
      }
      const r = await pool.query(
        `SELECT ${selectCols} FROM ${table} ${where} ORDER BY ${listOrderBy}`,
        params
      );
      res.json(r.rows);
    } catch (err) {
      handleErr(res, `GET ${tag}`, err);
    }
  });

  if (softDelete) {
    // GET /trash — items deleted in the last 30 days. Older rows are
    // hard-deleted opportunistically before the list is returned, so
    // the user never sees stale "recoverable" entries.
    router.get("/trash", async (req, res) => {
      try {
        const scope = await scopeFor(req);
        const conds = [];
        if (scope.where) conds.push(scope.where);
        const params = [...scope.params];

        // Purge anything older than 30 days for this teacher.
        const purgeConds = [...conds, "deleted_at IS NOT NULL", "deleted_at < NOW() - INTERVAL '30 days'"];
        await pool.query(
          `DELETE FROM ${table} WHERE ${purgeConds.join(" AND ")}`,
          params
        );

        const listConds = [...conds, "deleted_at IS NOT NULL"];
        const r = await pool.query(
          `SELECT ${selectCols} FROM ${table} WHERE ${listConds.join(" AND ")}
             ORDER BY deleted_at DESC`,
          params
        );
        res.json(r.rows);
      } catch (err) {
        handleErr(res, `GET ${tag}/trash`, err);
      }
    });

    // POST /:id/restore — clear deleted_at so the row resurfaces in
    // the normal list.
    router.post("/:id/restore", async (req, res) => {
      try {
        const scope = await scopeFor(req);
        const params = [req.params.id];
        const conds = [`id = $1`, `deleted_at IS NOT NULL`];
        if (scope.where) {
          params.push(...scope.params);
          conds.push(`account_id = $${params.length}`);
        }
        const r = await pool.query(
          `UPDATE ${table} SET deleted_at = NULL ${timestampOnPatch ? `, ${timestampOnPatch} = NOW()` : ""}
             WHERE ${conds.join(" AND ")} RETURNING ${selectCols}`,
          params
        );
        if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
        res.json(r.rows[0]);
      } catch (err) {
        handleErr(res, `POST ${tag}/:id/restore`, err);
      }
    });

    // DELETE /:id/forever — hard delete, bypasses the 30-day window.
    router.delete("/:id/forever", async (req, res) => {
      try {
        const scope = await scopeFor(req);
        const params = [req.params.id];
        let where = `WHERE id = $1`;
        if (scope.where) {
          params.push(...scope.params);
          where += ` AND account_id = $${params.length}`;
        }
        const r = await pool.query(`DELETE FROM ${table} ${where}`, params);
        if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
        res.json({ ok: true });
      } catch (err) {
        handleErr(res, `DELETE ${tag}/:id/forever`, err);
      }
    });
  }

  const postMiddleware  = bodySchema  ? [validateBody(bodySchema)]  : [];
  const patchMiddleware = patchSchema ? [validateBody(patchSchema)] : [];

  router.post("/", ...postMiddleware, async (req, res) => {
    try {
      const scope = await scopeFor(req);
      const body = coerceJson({ ...(req.body || {}) });
      if (teacherScoped) body.account_id = scope.teacherId;

      const allowed = teacherScoped ? [...fields, "account_id"] : fields;
      const { sets, params } = buildPatch(body, allowed);
      if (sets.length === 0) return res.status(400).json({ error: "No fields" });

      const cols = allowed.filter((k) => Object.prototype.hasOwnProperty.call(body, k));
      const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
      const r = await pool.query(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
         RETURNING ${selectCols}`,
        params
      );
      if (afterMutation) await afterMutation(r.rows[0]);
      res.status(201).json(r.rows[0]);
    } catch (err) {
      handleErr(res, `POST ${tag}`, err);
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const scope = await scopeFor(req);
      const params = [req.params.id];
      let where = `WHERE id = $1`;
      if (scope.where) {
        params.push(...scope.params);
        where += ` AND account_id = $${params.length}`;
      }
      if (softDelete) where += ` AND deleted_at IS NULL`;
      const r = await pool.query(`SELECT ${selectCols} FROM ${table} ${where}`, params);
      if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(r.rows[0]);
    } catch (err) {
      handleErr(res, `GET ${tag}/:id`, err);
    }
  });

  router.patch("/:id", ...patchMiddleware, async (req, res) => {
    try {
      const scope = await scopeFor(req);
      const { sets, params } = buildPatch(coerceJson(req.body || {}), fields);
      if (sets.length === 0) return res.status(400).json({ error: "No fields" });

      params.push(req.params.id);
      const idIdx = params.length;
      const ts = timestampOnPatch ? `, ${timestampOnPatch} = NOW()` : "";

      let where = `WHERE id = $${idIdx}`;
      if (scope.where) {
        params.push(...scope.params);
        where += ` AND account_id = $${params.length}`;
      }
      const r = await pool.query(
        `UPDATE ${table} SET ${sets.join(", ")}${ts} ${where} RETURNING ${selectCols}`,
        params
      );
      if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
      if (afterMutation) await afterMutation(r.rows[0]);
      res.json(r.rows[0]);
    } catch (err) {
      handleErr(res, `PATCH ${tag}/:id`, err);
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const scope = await scopeFor(req);
      const params = [req.params.id];
      let where = `WHERE id = $1`;
      if (scope.where) {
        params.push(...scope.params);
        where += ` AND account_id = $${params.length}`;
      }
      if (softDelete) {
        // Soft delete: flip deleted_at and leave the row in place so
        // the user has 30 days to recover from /trash.
        const r = await pool.query(
          `UPDATE ${table} SET deleted_at = NOW() ${where} AND deleted_at IS NULL`,
          params
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
        return res.json({ ok: true, soft: true });
      }
      const r = await pool.query(`DELETE FROM ${table} ${where}`, params);
      if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err) {
      handleErr(res, `DELETE ${tag}/:id`, err);
    }
  });

  return router;
}
