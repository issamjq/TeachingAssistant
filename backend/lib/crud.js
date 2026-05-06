import { Router } from "express";
import { pool } from "./db.js";
import { buildPatch, handleErr } from "./helpers.js";

// Build a standard CRUD router for a single table.
//   table       : SQL table name
//   fields      : columns clients are allowed to set (used for INSERT / UPDATE)
//   selectCols  : columns to return (RETURNING + GET projection)
//   listOrderBy : ORDER BY clause for the list endpoint (no leading "ORDER BY")
//   timestampOnPatch : column to set to NOW() on PATCH (e.g. "updated_at" or "last_edited"); pass null to skip
//   listExtra(req)   : optional async function returning { where, params }
//                      to scope the list (used by /api/students for ?teacher=me)
//
// Endpoints mounted (relative to wherever this router is .use()'d):
//   GET    /        list rows
//   POST   /        create — body is a partial object of `fields`
//   GET    /:id     fetch one
//   PATCH  /:id     partial update — only fields in `fields` are written
//   DELETE /:id     hard delete
export function crudRouter({
  table,
  fields,
  selectCols,
  listOrderBy,
  timestampOnPatch = "updated_at",
  routeName,
  listExtra = null,
  afterMutation = null,
}) {
  const router = Router();
  const tag = routeName || `/api/${table}`;

  router.get("/", async (req, res) => {
    try {
      let where = "";
      let params = [];
      if (listExtra) {
        const extra = await listExtra(req);
        if (extra?.skip) return res.json([]);
        if (extra?.where) {
          where = extra.where;
          params = extra.params || [];
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

  router.post("/", async (req, res) => {
    try {
      const body = req.body || {};
      const { sets, params } = buildPatch(body, fields);
      if (sets.length === 0) return res.status(400).json({ error: "No fields" });
      const cols = fields.filter((k) => Object.prototype.hasOwnProperty.call(body, k));
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
      const r = await pool.query(`SELECT ${selectCols} FROM ${table} WHERE id = $1`, [req.params.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(r.rows[0]);
    } catch (err) {
      handleErr(res, `GET ${tag}/:id`, err);
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const { sets, params } = buildPatch(req.body || {}, fields);
      if (sets.length === 0) return res.status(400).json({ error: "No fields" });
      params.push(req.params.id);
      const ts = timestampOnPatch ? `, ${timestampOnPatch} = NOW()` : "";
      const r = await pool.query(
        `UPDATE ${table} SET ${sets.join(", ")}${ts}
          WHERE id = $${params.length}
          RETURNING ${selectCols}`,
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
      const r = await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
      if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err) {
      handleErr(res, `DELETE ${tag}/:id`, err);
    }
  });

  return router;
}
