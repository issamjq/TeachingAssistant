import "dotenv/config";
import pg from "pg";

// Keep DATE columns (OID 1082) as the raw "YYYY-MM-DD" string instead of
// letting node-postgres turn them into a JS Date at LOCAL midnight. That
// Date, once JSON-serialized by Express (toISOString → UTC), rolled the
// day back by one in UTC+ timezones (UAE = +4): a quiz set to May 17
// came back as "2026-05-16T20:00:00Z" and showed everywhere as May 16.
// A plain date string has no timezone, so it round-trips exactly.
pg.types.setTypeParser(1082, (v) => v);

// Single pg.Pool shared by every route handler. Render's web service is a
// long-running process so a pool with the default size is the right shape;
// in dev (Vite middleware) the same module instance gives us the same pool.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ── Tenant-scoped execution (row-level security) ───────────────────────
//
// Postgres RLS is the backstop under crud.js's `WHERE account_id = $1`.
// Application code is the first line; this is what catches the hand-written
// route that forgets. It matters more the moment student rows exist, because
// a scope miss there is a minors-data breach, not an inconvenience.
//
// Three facts drive the shape of this helper. All three were verified against
// the live database, not assumed:
//
//   1. `neondb_owner` has the BYPASSRLS role attribute, and BYPASSRLS defeats
//      even FORCE ROW LEVEL SECURITY. Enabling RLS while connected as the
//      owner enforces NOTHING — the policies exist, read correctly, and are
//      silently inert. That is worse than no RLS at all, because it looks
//      done. We therefore switch to a dedicated `murchid_app` role that has
//      no bypass, for the duration of the query.
//
//   2. The pool hands out arbitrary connections. A plain `SET ROLE` or `SET`
//      would persist on that physical connection and bleed into whichever
//      request picks it up next — a cross-tenant leak created by the very
//      code meant to prevent one. Everything here is therefore transaction-
//      local: `SET LOCAL ROLE` and `set_config(..., true)` both reset on
//      COMMIT or ROLLBACK. Verified: after COMMIT the connection is back to
//      `neondb_owner` with the setting cleared.
//
//   3. The policies read the tenant from `current_setting('app.current_account',
//      true)`. The `true` means "return NULL if unset" rather than throwing,
//      and NULL compares to nothing — so a query that reaches a policy without
//      a tenant set returns ZERO rows. It fails closed. A bug here shows up as
//      missing data, never as another teacher's data.
const TENANT_SETTING = "app.current_account";

/**
 * Bind the tenant on a client whose transaction the caller already owns.
 *
 * For handlers that manage their own `BEGIN`/`COMMIT` (multi-statement writes
 * like quiz sync, which must be atomic for reasons of their own). Call this
 * immediately after BEGIN; both settings are transaction-local and unwind with
 * it, exactly as in withTenant().
 *
 * Prefer withTenant() — reach for this only when the handler genuinely needs
 * to control its own transaction boundaries.
 *
 * @param {pg.PoolClient} client  a client with an open transaction
 * @param {number|string} accountId
 */
export async function bindTenant(client, accountId) {
  if (accountId === null || accountId === undefined || accountId === "") {
    throw new Error("bindTenant: accountId is required");
  }
  await client.query("SET LOCAL ROLE murchid_app");
  await client.query("SELECT set_config($1, $2, true)", [
    TENANT_SETTING,
    String(accountId),
  ]);
}

/**
 * Run `fn` with Postgres RLS actively enforcing tenant isolation.
 *
 * Everything inside runs in one transaction as the non-privileged
 * `murchid_app` role with the tenant id bound, so policies apply. `fn`
 * receives a client — use it for every query in the callback; queries sent
 * through the shared `pool` instead will run outside the transaction, as the
 * bypassing owner, with no isolation.
 *
 * @param {number|string} accountId  verified account id (req.account.id)
 * @param {(client: pg.PoolClient) => Promise<any>} fn
 */
export async function withTenant(accountId, fn) {
  if (accountId === null || accountId === undefined || accountId === "") {
    // Refuse rather than run unscoped. Callers must resolve the account first.
    throw new Error("withTenant: accountId is required");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE murchid_app");
    await client.query("SELECT set_config($1, $2, true)", [
      TENANT_SETTING,
      String(accountId),
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* connection already gone */ }
    throw err;
  } finally {
    // Always release. The LOCAL settings die with the transaction, so the
    // connection returns to the pool clean either way.
    client.release();
  }
}
