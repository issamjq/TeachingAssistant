// Keyset ("cursor") pagination for the list endpoints.
//
// Why keyset and not LIMIT/OFFSET:
//
//   1. OFFSET makes Postgres walk and discard every skipped row, so page 40
//      of a roster costs 40× page 1. Keyset seeks straight to the first row
//      after the cursor, so every page costs the same.
//   2. OFFSET is unstable under concurrent writes. A teacher who adds a
//      student while paging sees a row twice, or never — the window shifts
//      under them. A cursor names a position in the sort order, not an
//      ordinal, so inserts elsewhere in the list can't duplicate or skip.
//
// The cost is that keyset needs a TOTAL order. Half the routers order by a
// non-unique column ("grade, section, last_name, first_name"), so we append
// `id` as a final tiebreaker when it isn't already there — invisible in the
// output (it only breaks ties that were previously arbitrary) but it is what
// makes a cursor point at exactly one row.
//
// Three things are load-bearing and easy to get wrong later:
//
//   - NULLs. Postgres sorts NULLs LAST for ASC and FIRST for DESC unless told
//     otherwise, and two of our routers say NULLS LAST explicitly on a DESC
//     column. A comparison that ignores this silently drops or repeats the
//     null rows at the page boundary, so afterSql() branches on all four
//     combinations. See the table there.
//   - Round-trip precision. The cursor carries each sort value as the TEXT
//     Postgres itself rendered (`(col)::text`), not as a JSON-serialized JS
//     value. node-postgres turns timestamptz into a JS Date, which is
//     millisecond-precision — feeding that back would land mid-microsecond
//     and skip rows. Binding the raw text back into `col > $n` lets Postgres
//     infer the parameter type from the column and parse it with that type's
//     own input function, so the value round-trips exactly.
//   - Identifiers. Column names here come from the `listOrderBy` a router
//     declares in code, never from a request, and they are interpolated into
//     SQL. parseOrderBy() therefore accepts nothing but a bare identifier and
//     throws otherwise — at module load, so a malformed clause crashes the
//     boot rather than reaching a query.
//
// The cursor itself is NOT a security boundary and is not signed. Its values
// only move a window inside a result set the caller is already authorised to
// read: the `WHERE account_id = $1` scope and the RLS policy under it both
// still apply to every paged query. A forged cursor can reposition the
// caller's own list and nothing else. The shape key below exists to catch a
// cursor used against the wrong endpoint (a client bug), not an attacker.

import { Buffer } from "node:buffer";

// Base64 of a 2 KB cursor is already ~100× anything we emit; anything larger
// is junk and is rejected before we spend memory decoding it.
const MAX_CURSOR_CHARS = 2048;

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

// Thrown for anything client-supplied that we refuse. Carries `status` so the
// caller can map it to a 400 without string-matching the message.
export class PaginationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PaginationError";
    this.status = 400;
  }
}

const TERM_RE =
  /^([a-z_][a-z0-9_]*)(?:\s+(asc|desc))?(?:\s+nulls\s+(first|last))?$/i;

// Parse an ORDER BY clause (no leading "ORDER BY") into ordered terms.
// Developer-authored input only — throws on anything it can't parse rather
// than guessing, so the failure lands at boot instead of in a query plan.
export function parseOrderBy(clause) {
  const terms = String(clause || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (terms.length === 0) {
    throw new Error(`pagination: empty ORDER BY clause: ${JSON.stringify(clause)}`);
  }
  return terms.map((term) => {
    const m = TERM_RE.exec(term);
    if (!m) {
      throw new Error(
        `pagination: cannot parse ORDER BY term ${JSON.stringify(term)}. ` +
          `Only "column [ASC|DESC] [NULLS FIRST|LAST]" is supported — an ` +
          `expression there would need a matching keyset comparison.`
      );
    }
    const col = m[1];
    const dir = (m[2] || "ASC").toUpperCase();
    // Postgres' own defaults when NULLS is omitted. Getting this wrong is
    // invisible until a null lands exactly on a page boundary.
    const nulls = (m[3] || (dir === "DESC" ? "FIRST" : "LAST")).toUpperCase();
    return { col, dir, nulls };
  });
}

// Cheap non-cryptographic hash (FNV-1a). Used only to tag a cursor with the
// query shape it was minted for, so /api/quizzes' cursor is rejected by
// /api/homework instead of being silently misinterpreted.
function shapeHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

// Every spec ever built, so verifyKeysetSpecs() can check them all against the
// live schema at boot. Specs are created once per router at import time, so
// this is a fixed, small list — not a leak.
const SPECS = [];

/**
 * Build everything the list query needs from a router's `listOrderBy`.
 * Call once at router construction — it parses and validates, so a bad
 * clause fails the boot rather than the request.
 *
 * @param {string} clause     e.g. "updated_at DESC, id DESC"
 * @param {string} table      real table name (checked against the schema)
 * @param {string} shapeSalt  distinguishes two specs over the same table
 *                            (the main list vs /trash) in the cursor's key
 */
export function buildOrderSpec(clause, table = "", shapeSalt = "") {
  const terms = parseOrderBy(clause);
  // Total order or it isn't a keyset. `id` is the primary key on every table
  // crudRouter serves; appending it only breaks ties that were previously
  // resolved arbitrarily by the planner, so no visible order changes.
  //
  // It inherits the direction of the term before it rather than defaulting to
  // ASC. Two reasons, and the second is the one that bites: a "newest first"
  // list should break ties newest-id-first, and a hardcoded ASC would make an
  // otherwise all-DESC clause mixed-direction — which disqualifies it from the
  // row-value fast path in keysetWhere() for no reason at all. Caught in review
  // by testing a DESC clause, since every clause in the repo today either
  // names `id` explicitly or leads ASC.
  if (!terms.some((t) => t.col === "id")) {
    const last = terms[terms.length - 1];
    terms.push({ col: "id", dir: last.dir, nulls: last.dir === "DESC" ? "FIRST" : "LAST" });
  }
  const orderSql = terms
    .map((t) => `${t.col} ${t.dir} NULLS ${t.nulls}`)
    .join(", ");
  const spec = {
    table,
    terms,
    orderSql,
    // Extra projection carrying each sort value as Postgres' own text form.
    // Stripped from the response by stripCursorCols() before it goes out.
    selectSql: terms.map((t, i) => `, (${t.col})::text AS ${cursorAlias(i)}`).join(""),
    shapeKey: shapeHash(`${table}|${shapeSalt}|${orderSql}`),
    // Row-value comparison needs one direction for the whole tuple — SQL has
    // no per-column direction in `(a,b) > (x,y)`.
    uniformDir: terms.every((t) => t.dir === terms[0].dir) ? terms[0].dir : null,
    // Flipped on by verifyKeysetSpecs() once the schema confirms no sort
    // column is nullable. Starts false so the safe path is the default: a
    // spec that is never verified is slow, never wrong.
    rowValueSafe: false,
  };
  SPECS.push(spec);
  return spec;
}

/**
 * Enable the row-value fast path on the specs that can prove it is safe.
 *
 * Why this needs the database. Two cursor predicates are possible:
 *
 *   OR-expansion   `(a > $1) OR (a = $1 AND b > $2) OR …`
 *                  Correct for any mix of directions and NULLs, but opaque to
 *                  the planner: measured on a 2,000-row roster it scanned 284
 *                  buffers and filtered 1,500 rows away — no better than the
 *                  OFFSET it replaced.
 *
 *   Row value      `(a, b) > ($1, $2)`
 *                  Postgres folds this straight into an Index Cond — 14
 *                  buffers for the same page, identical to page one. But it
 *                  needs one direction for the whole tuple, and it silently
 *                  DROPS rows where any sort column is NULL (SQL row
 *                  comparison yields NULL, not true, at the deciding column).
 *
 * So the fast path is only sound when every sort column is NOT NULL, and that
 * is a fact about the schema, not about the code. Asking Postgres once at boot
 * keeps the two in step: add a nullable sort column later and the fast path
 * turns itself off instead of quietly losing rows.
 *
 * Fire-and-forget from buildApp(). Requests served before it resolves take the
 * safe path; failure leaves every spec on the safe path.
 *
 * @param {import("pg").Pool} pool
 */
export async function verifyKeysetSpecs(pool) {
  const tables = [...new Set(SPECS.map((s) => s.table).filter(Boolean))];
  if (tables.length === 0) return { verified: 0, total: 0 };

  const r = await pool.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1) AND is_nullable = 'NO'`,
    [tables]
  );
  const notNull = new Map();
  for (const row of r.rows) {
    if (!notNull.has(row.table_name)) notNull.set(row.table_name, new Set());
    notNull.get(row.table_name).add(row.column_name);
  }

  let verified = 0;
  for (const spec of SPECS) {
    const cols = notNull.get(spec.table) || new Set();
    spec.rowValueSafe = Boolean(spec.uniformDir) && spec.terms.every((t) => cols.has(t.col));
    if (spec.rowValueSafe) verified++;
  }
  return { verified, total: SPECS.length };
}

const cursorAlias = (i) => `__cur_${i}`;

// Drop the cursor projection so clients never see it. Returns a plain object
// with the same keys the endpoint returned before pagination existed.
export function stripCursorCols(row, spec) {
  const out = { ...row };
  for (let i = 0; i < spec.terms.length; i++) delete out[cursorAlias(i)];
  return out;
}

// Mint the cursor for the last row of a page.
export function encodeCursor(spec, row) {
  const values = spec.terms.map((_, i) => {
    const v = row[cursorAlias(i)];
    return v === undefined || v === null ? null : String(v);
  });
  const json = JSON.stringify({ k: spec.shapeKey, v: values });
  return Buffer.from(json, "utf8").toString("base64url");
}

// Decode + validate a client cursor into its sort values.
// Every failure mode is a 400: a cursor is opaque to the client, so a
// malformed one is a bug (or a probe), never something to recover from.
export function decodeCursor(spec, cursor) {
  if (typeof cursor !== "string" || cursor.length === 0) {
    throw new PaginationError("Invalid cursor.");
  }
  if (cursor.length > MAX_CURSOR_CHARS) {
    throw new PaginationError("Invalid cursor.");
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new PaginationError("Invalid cursor.");
  }
  if (!parsed || parsed.k !== spec.shapeKey || !Array.isArray(parsed.v)) {
    // Wrong endpoint, or the router's sort order changed under a client
    // holding an old cursor. Either way: start again from page one.
    throw new PaginationError("Cursor does not match this query. Reload the list.");
  }
  if (parsed.v.length !== spec.terms.length) {
    throw new PaginationError("Invalid cursor.");
  }
  for (const v of parsed.v) {
    if (v !== null && typeof v !== "string") throw new PaginationError("Invalid cursor.");
  }
  return parsed.v;
}

// "Is this row strictly after the cursor value on this column?"
//
//   direction  nulls   cursor value   predicate
//   ─────────────────────────────────────────────────────────────
//   ASC        LAST    null           (nothing sorts after a trailing null)
//   ASC        LAST    v              col > v OR col IS NULL
//   ASC        FIRST   null           col IS NOT NULL
//   ASC        FIRST   v              col > v
//   DESC       FIRST   null           col IS NOT NULL
//   DESC       FIRST   v              col < v
//   DESC       LAST    null           (nothing sorts after a trailing null)
//   DESC       LAST    v              col < v OR col IS NULL
//
// Returns null when no row can qualify — that branch is dropped rather than
// emitted as `false`, so the planner sees a clean predicate.
function afterSql(term, value, paramIndex) {
  const nullsTrail = term.nulls === "LAST";
  const cmp = term.dir === "DESC" ? "<" : ">";
  if (value === null) {
    return nullsTrail ? null : `${term.col} IS NOT NULL`;
  }
  return nullsTrail
    ? `(${term.col} ${cmp} $${paramIndex} OR ${term.col} IS NULL)`
    : `${term.col} ${cmp} $${paramIndex}`;
}

// Equality on the tie-breaking prefix. A NULL cursor value means "the rows
// tied here are the ones that are also NULL" — `col = NULL` would match
// nothing, which is the classic way to lose a page boundary.
function eqSql(term, value, paramIndex) {
  return value === null ? `${term.col} IS NULL` : `${term.col} = $${paramIndex}`;
}

/**
 * Build the "everything after this cursor" predicate.
 *
 * Lexicographic expansion: a row is after the cursor if it beats it on the
 * first sort column, or ties there and beats it on the second, and so on.
 * Row-value syntax `(a, b) > ($1, $2)` would be shorter but Postgres only
 * accepts it when every column sorts the same direction, and ours don't.
 *
 * @param {object} spec        from buildOrderSpec()
 * @param {(string|null)[]} values  from decodeCursor()
 * @param {number} paramOffset how many $n placeholders the query already uses
 * @returns {{sql: string, params: (string|null)[]}}
 */
export function keysetWhere(spec, values, paramOffset = 0) {
  // Fast path — see verifyKeysetSpecs() for why it needs the schema's
  // blessing. `values` can only contain a null if some sort column is
  // nullable, so the check is belt-and-braces against a spec verified against
  // one schema and run against another.
  if (spec.rowValueSafe && values.every((v) => v !== null)) {
    const cmp = spec.uniformDir === "DESC" ? "<" : ">";
    const cols = spec.terms.map((t) => t.col).join(", ");
    const ph = values.map((_, i) => `$${paramOffset + i + 1}`).join(", ");
    return { sql: `(${cols}) ${cmp} (${ph})`, params: [...values] };
  }

  const params = [];
  const branches = [];
  let next = paramOffset;

  for (let i = 0; i < spec.terms.length; i++) {
    const conds = [];
    const pending = [];
    for (let j = 0; j < i; j++) {
      const v = values[j];
      if (v === null) {
        conds.push(eqSql(spec.terms[j], null));
      } else {
        pending.push(v);
        conds.push(eqSql(spec.terms[j], v, next + pending.length));
      }
    }
    const v = values[i];
    const after =
      v === null
        ? afterSql(spec.terms[i], null)
        : afterSql(spec.terms[i], v, next + pending.length + 1);
    if (after === null) continue; // unsatisfiable branch — see afterSql()
    if (v !== null) pending.push(v);
    conds.push(after);

    params.push(...pending);
    next += pending.length;
    branches.push(conds.length === 1 ? conds[0] : `(${conds.join(" AND ")})`);
  }

  // No branch can match only if every term is a trailing NULL — impossible
  // while `id` is in the spec, but a query that returns nothing beats one
  // that returns everything if that ever changes.
  if (branches.length === 0) return { sql: "false", params: [] };
  return { sql: `(${branches.join(" OR ")})`, params };
}

/**
 * Validate `?limit=`. Absent → DEFAULT_LIMIT. Present → must be a positive
 * integer, clamped to MAX_LIMIT.
 *
 * Deliberately strict about garbage rather than falling back to the default:
 * a client sending `limit=all` has a bug, and silently serving 50 rows hides
 * it until someone wonders why their list is truncated.
 */
export function parseLimit(raw, { def = DEFAULT_LIMIT, max = MAX_LIMIT } = {}) {
  if (raw === undefined || raw === null || raw === "") return def;
  if (Array.isArray(raw)) throw new PaginationError("limit must be a single value.");
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) throw new PaginationError("limit must be a positive integer.");
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new PaginationError("limit must be a positive integer.");
  }
  return Math.min(n, max);
}
