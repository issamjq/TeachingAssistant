import { Router } from "express";
import { pool, withTenant } from "./db.js";
import { buildPatch, handleErr } from "./helpers.js";
import { loadCurrentTeacher } from "./currentTeacher.js";
import { validateBody } from "./validate.js";
import {
  buildOrderSpec, decodeCursor, encodeCursor, keysetWhere, parseLimit,
  stripCursorCols, PaginationError,
} from "./pagination.js";

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
//   beforeDelete(id, req) : optional callback fired with the row's id BEFORE
//                    it is removed, for work that needs the row to still
//                    exist (accounts uses it to resolve a cached identity).
//                    Throwing aborts the delete.
//   softDelete     : if true, DELETE flips a deleted_at timestamp instead
//                    of removing the row. GETs hide soft-deleted rows.
//                    Adds /trash, /:id/restore, /:id/forever routes and
//                    auto-purges anything > 30 days old on /trash access.
//
//   Every list endpoint is cursor-paginated — `?limit=` (default 50, hard
//   max 200) and `?cursor=`, returning { items, nextCursor }. There is no
//   opt-out: an unpaginated list is a table scan waiting for the first real
//   roster, and leaving it switchable means it eventually gets switched.
//   See pagination.js for how the cursor is built and why it is not signed.
//
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
  beforeDelete = null,
  softDelete = false,
  jsonFields = [],
  // Optional zod schemas. When provided, the POST / PATCH routes get a
  // validateBody() middleware that rejects unknown / oversized / wrong-
  // type fields before they reach the handler. Strongly recommended for
  // any table that accepts user-typed data (students, schools, …).
  bodySchema = null,
  patchSchema = null,
  // Register the read routes only (GET / and GET /:id). Use when another
  // router already owns the resource's write lifecycle with guards this
  // generic factory cannot express — refusing self-mutation, enforcing a
  // role hierarchy, or writing an audit_log row. Without this, mounting the
  // factory silently publishes a second, unguarded way to do the same job
  // (see F45: /api/teachers vs the audited routes in admin.js).
  readOnly = false,
}) {
  const router = Router();
  // Write routes register on `w`. When readOnly is set, `w` is a throwaway
  // Router that is never mounted, so the handlers below keep one shape and
  // the write verbs simply fall through to the 404 handler in app.js.
  const w = readOnly ? Router() : router;
  const tag = routeName || `/api/${table}`;

  // Parsed once, at construction. A listOrderBy that keyset pagination can't
  // express throws here — during import, so it takes the boot down instead of
  // surfacing as a broken list months later. /trash has its own order and so
  // needs its own spec; a cursor from one is rejected by the other.
  const listSpec  = buildOrderSpec(listOrderBy, table);
  const trashSpec = softDelete ? buildOrderSpec("deleted_at DESC", table, "trash") : null;

  // /trash needs deleted_at in the payload — the recovery UI shows when an item
  // was deleted and how many of its 30 days are left. Not one router declared it
  // in `selectCols`, so every trash panel in the product rendered "Deleted
  // Invalid Date · NaN days left".
  //
  // Added here rather than to six routers' select lists for two reasons: the
  // /trash route only exists because `softDelete` is on, so the column it needs
  // should come from the same switch and can't be forgotten by a router added
  // later; and the normal list keeps its payload clean, since there deleted_at
  // is NULL on every row by definition.
  const trashSelect = softDelete && !/(^|,)\s*deleted_at\s*(,|$)/.test(selectCols)
    ? `${selectCols}, deleted_at`
    : selectCols;

  // Compose one page of `spec`-ordered rows.
  //
  // Split into build/finish rather than one run() because /trash must purge
  // and list inside a single transaction — it owns its db handle and can't
  // hand query execution off to a helper.
  //
  // Asks for limit+1 rows: the extra row is how we know another page exists,
  // and it costs one row rather than a second COUNT(*) over the whole table.
  const buildPage = (req, spec, { where, params, select = selectCols }) => {
    const limit = parseLimit(req.query.limit);
    const args = [...params];
    let clause = where;

    if (req.query.cursor !== undefined) {
      const values = decodeCursor(spec, req.query.cursor);
      const ks = keysetWhere(spec, values, args.length);
      clause = clause ? `${clause} AND ${ks.sql}` : `WHERE ${ks.sql}`;
      args.push(...ks.params);
    }
    args.push(limit + 1);

    return {
      limit,
      args,
      sql: `SELECT ${select}${spec.selectSql} FROM ${table} ${clause}
              ORDER BY ${spec.orderSql} LIMIT $${args.length}`,
    };
  };

  const finishPage = (rows, limit, spec) => {
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) => stripCursorCols(row, spec)),
      nextCursor: hasMore ? encodeCursor(spec, page[page.length - 1]) : null,
    };
  };

  const EMPTY_PAGE = { items: [], nextCursor: null };

  // A bad ?cursor= / ?limit= is the client's mistake, not a server fault, so
  // it gets a 400 with a usable message instead of handleErr()'s opaque 500.
  const handleListErr = (res, label, err) => {
    if (err instanceof PaginationError) {
      return res.status(err.status).json({ error: err.message });
    }
    return handleErr(res, label, err);
  };

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

  // Run one handler's database work with row-level security actually
  // enforcing the tenant boundary.
  //
  // The `WHERE account_id = $1` above is unchanged and still does the real
  // filtering — this is the layer underneath it. If a future edit drops that
  // clause, RLS returns zero rows instead of another teacher's data; the bug
  // surfaces as missing records rather than as a leak.
  //
  // Cross-tenant routers (teachers.js mounts this with teacherScoped:false so
  // admins can list every account) have no tenant to bind and keep running on
  // the pool, where the owner's BYPASSRLS applies. That is deliberate: an
  // admin listing all teachers is the one case that must see across tenants,
  // and it is already gated by requireRole() at the mount point.
  const runScoped = (scope, fn) =>
    scope.teacherId ? withTenant(scope.teacherId, fn) : fn(pool);

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
        if (extra?.skip) return res.json(EMPTY_PAGE);
        if (extra?.where) {
          // Re-base extra's $N placeholders on top of current params length.
          const offset = params.length;
          const rebased = extra.where.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`);
          where = where ? `${where} AND ${rebased}` : `WHERE ${rebased}`;
          params = [...params, ...(extra.params || [])];
        }
      }
      // The cursor predicate is appended AFTER listExtra's filters, so a
      // cursor only ever narrows within the same filtered set. Changing the
      // filters invalidates the position, which is why the client drops its
      // cursor whenever a filter changes rather than paging across two
      // different result sets.
      const page = buildPage(req, listSpec, { where, params });
      const r = await runScoped(scope, (db) => db.query(page.sql, page.args));
      res.json(finishPage(r.rows, page.limit, listSpec));
    } catch (err) {
      handleListErr(res, `GET ${tag}`, err);
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

        const purgeConds = [...conds, "deleted_at IS NOT NULL", "deleted_at < NOW() - INTERVAL '30 days'"];
        const listConds = [...conds, "deleted_at IS NOT NULL"];
        const page = buildPage(req, trashSpec, {
          where: `WHERE ${listConds.join(" AND ")}`,
          params,
          select: trashSelect,
        });
        // Purge-then-list share one transaction so the listing can't observe a
        // half-completed purge, and so the tenant is bound once rather than twice.
        // The purge keeps the un-paged param list — it deletes everything past
        // the window, not just what fits on this page.
        const r = await runScoped(scope, async (db) => {
          await db.query(
            `DELETE FROM ${table} WHERE ${purgeConds.join(" AND ")}`,
            params
          );
          return db.query(page.sql, page.args);
        });
        res.json(finishPage(r.rows, page.limit, trashSpec));
      } catch (err) {
        handleListErr(res, `GET ${tag}/trash`, err);
      }
    });

    // POST /:id/restore — clear deleted_at so the row resurfaces in
    // the normal list.
    w.post("/:id/restore", async (req, res) => {
      try {
        const scope = await scopeFor(req);
        const params = [req.params.id];
        const conds = [`id = $1`, `deleted_at IS NOT NULL`];
        if (scope.where) {
          params.push(...scope.params);
          conds.push(`account_id = $${params.length}`);
        }
        const r = await runScoped(scope, (db) => db.query(
          `UPDATE ${table} SET deleted_at = NULL ${timestampOnPatch ? `, ${timestampOnPatch} = NOW()` : ""}
             WHERE ${conds.join(" AND ")} RETURNING ${selectCols}`,
          params
        ));
        if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
        res.json(r.rows[0]);
      } catch (err) {
        handleErr(res, `POST ${tag}/:id/restore`, err);
      }
    });

    // DELETE /:id/forever — hard delete, bypasses the 30-day window.
    w.delete("/:id/forever", async (req, res) => {
      try {
        const scope = await scopeFor(req);
        const params = [req.params.id];
        let where = `WHERE id = $1`;
        if (scope.where) {
          params.push(...scope.params);
          where += ` AND account_id = $${params.length}`;
        }
        const r = await runScoped(scope, (db) => db.query(`DELETE FROM ${table} ${where}`, params));
        if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
        res.json({ ok: true });
      } catch (err) {
        handleErr(res, `DELETE ${tag}/:id/forever`, err);
      }
    });
  }

  const postMiddleware  = bodySchema  ? [validateBody(bodySchema)]  : [];
  const patchMiddleware = patchSchema ? [validateBody(patchSchema)] : [];

  w.post("/", ...postMiddleware, async (req, res) => {
    try {
      const scope = await scopeFor(req);
      const body = coerceJson({ ...(req.body || {}) });
      if (teacherScoped) body.account_id = scope.teacherId;

      const allowed = teacherScoped ? [...fields, "account_id"] : fields;
      const { sets, params } = buildPatch(body, allowed);
      if (sets.length === 0) return res.status(400).json({ error: "No fields" });

      const cols = allowed.filter((k) => Object.prototype.hasOwnProperty.call(body, k));
      const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
      const r = await runScoped(scope, (db) => db.query(
        `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})
         RETURNING ${selectCols}`,
        params
      ));
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
      const r = await runScoped(scope, (db) =>
        db.query(`SELECT ${selectCols} FROM ${table} ${where}`, params));
      if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
      res.json(r.rows[0]);
    } catch (err) {
      handleErr(res, `GET ${tag}/:id`, err);
    }
  });

  w.patch("/:id", ...patchMiddleware, async (req, res) => {
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
      const r = await runScoped(scope, (db) => db.query(
        `UPDATE ${table} SET ${sets.join(", ")}${ts} ${where} RETURNING ${selectCols}`,
        params
      ));
      if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
      if (afterMutation) await afterMutation(r.rows[0]);
      res.json(r.rows[0]);
    } catch (err) {
      handleErr(res, `PATCH ${tag}/:id`, err);
    }
  });

  w.delete("/:id", async (req, res) => {
    try {
      const scope = await scopeFor(req);
      if (beforeDelete) await beforeDelete(req.params.id, req);
      const params = [req.params.id];
      let where = `WHERE id = $1`;
      if (scope.where) {
        params.push(...scope.params);
        where += ` AND account_id = $${params.length}`;
      }
      if (softDelete) {
        // Soft delete: flip deleted_at and leave the row in place so
        // the user has 30 days to recover from /trash.
        const r = await runScoped(scope, (db) => db.query(
          `UPDATE ${table} SET deleted_at = NOW() ${where} AND deleted_at IS NULL`,
          params
        ));
        if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
        return res.json({ ok: true, soft: true });
      }
      const r = await runScoped(scope, (db) => db.query(`DELETE FROM ${table} ${where}`, params));
      if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
      res.json({ ok: true });
    } catch (err) {
      handleErr(res, `DELETE ${tag}/:id`, err);
    }
  });

  return router;
}
