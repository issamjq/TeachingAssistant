// Auth middleware — verifies the Firebase ID token on the Authorization
// header, looks the account up by firebase_uid, and stashes both on
// req.firebaseUser / req.account for downstream handlers.
//
// Routes that legitimately run unauthenticated (the marketing /healthz,
// the school catalog, and POST /api/auth/firebase itself) opt out by
// being mounted BEFORE this middleware in app.js, or by skipping the
// check via the `optional` flag.
//
// On a verified-but-unknown user (firebase_uid not yet in DB), req.account
// is null and downstream routes get to decide whether to upsert. The
// /api/auth/firebase route uses this to create the row on first login.
import { pool } from "./db.js";
import { verifyIdToken } from "./firebaseAdmin.js";
import { isPrivilegedRole } from "./roles.js";
import { cacheGet, cacheSet, cacheDel } from "./cache.js";

// Extract the client IP, honoring the X-Forwarded-For chain Render +
// Vercel add when proxying. Fall back to socket address otherwise.
export const clientIp = (req) => {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
};

export const userAgent = (req) => req.headers["user-agent"] || null;

const ACCOUNT_COLS = `id, first_name, last_name, email, phone, staff_id, majors, grade_levels,
                       languages, sections, class_map, grade_sections,
                       nationality, hire_date, bio,
                       role, sub_role, status, firebase_uid, avatar_url,
                       subscription_status, subscription_ends_at, subscription_plan,
                       last_login_at, last_login_ip, active_session_id,
                       created_at, updated_at`;

export const ACCOUNT_COLS_SQL = ACCOUNT_COLS;

// ── Account cache (F38) ────────────────────────────────────────────────
//
// requireAuth() re-read the account row from Postgres on EVERY authenticated
// request. Measured dev→Neon that was ~96 ms of the ~213 ms an /api/me costs;
// co-located on Render it is smaller but it is still a round-trip in front of
// every single call the product makes.
//
// This is the one cache in the codebase that holds authorisation state, so
// the terms are strict:
//
//   TTL is seconds, not minutes. Everything that can change under a live
//   session — role, sub_role, status, subscription, active_session_id — is on
//   this row, so the TTL is the worst-case window in which a revocation is
//   not yet visible. 10s is short enough that no realistic attack fits in it
//   and long enough to collapse a page load's 3–8 calls onto one read.
//
//   Every write to `accounts` invalidates. The TTL is the backstop, not the
//   mechanism: sign-in (which rotates active_session_id and is what evicts
//   the previous device), suspension, role change, subscription change and
//   profile edits all call invalidateAccount* below. Miss one and that change
//   is delayed by the TTL — which is why the list of call sites is short and
//   deliberate. Grep for invalidateAccount before adding an accounts write.
//
//   Negative lookups are NOT cached. A verified uid with no row is a user
//   mid-bootstrap: POST /api/auth/firebase is about to create the row, and a
//   cached "no such account" would 404 their first few requests.
//
//   Multi-instance caveat: with REDIS_URL set, an invalidation is global. On
//   the in-process fallback it only clears the instance that served the write,
//   so other instances stay stale until the TTL. Set REDIS_URL before running
//   more than one Render instance.
//
// Set ACCOUNT_CACHE_TTL_SECONDS=0 to switch the cache off entirely.
const ACCOUNT_TTL_SECONDS = Number(process.env.ACCOUNT_CACHE_TTL_SECONDS ?? 10);

const uidKey = (uid) => `acct:uid:${uid}`;
const idKey  = (id)  => `acct:id:${id}`;

const readAccountByUid = async (uid) => {
  const r = await pool.query(
    `SELECT ${ACCOUNT_COLS} FROM accounts WHERE firebase_uid = $1`,
    [uid]
  );
  return r.rows[0] || null;
};

// Find the account row attached to a Firebase uid (or null).
export async function findAccountByUid(uid) {
  if (!(ACCOUNT_TTL_SECONDS > 0)) return readAccountByUid(uid);

  const hit = await cacheGet(uidKey(uid));
  if (hit !== undefined) return hit;

  const row = await readAccountByUid(uid);
  if (row) {
    // The id→uid pointer is what makes invalidation by account id exact:
    // written with the row, under the same TTL, so if the row is cached the
    // pointer is too. Admin routes know the id, not the Firebase uid.
    await cacheSet(uidKey(uid), row, ACCOUNT_TTL_SECONDS);
    await cacheSet(idKey(row.id), uid, ACCOUNT_TTL_SECONDS);
  }
  return row;
}

/** Drop the cached row for a Firebase uid. Safe to call with null/undefined. */
export async function invalidateAccountByUid(uid) {
  if (!uid) return;
  await cacheDel(uidKey(uid));
}

/**
 * Drop the cached row for an account id, following the id→uid pointer.
 * Falls back to the database when the pointer has expired but the row might
 * not have — cheap, and only on write paths.
 */
export async function invalidateAccountById(id) {
  if (id === null || id === undefined) return;
  const uid = await cacheGet(idKey(id));
  if (typeof uid === "string") {
    await cacheDel(uidKey(uid), idKey(id));
    return;
  }
  try {
    const r = await pool.query("SELECT firebase_uid FROM accounts WHERE id = $1", [id]);
    await cacheDel(uidKey(r.rows[0]?.firebase_uid), idKey(id));
  } catch {
    // Row already gone (a delete) — nothing left to resolve. The uid entry
    // expires on its own within ACCOUNT_TTL_SECONDS.
    await cacheDel(idKey(id));
  }
}

// Role enforcement — separate gate from the auth check itself. Routes
// that admins or devs should be able to call get `requireRole("admin")`
// or `requireRole("admin", "dev")` AFTER `requireAuth()`. Without it,
// any authenticated teacher could hit /api/admin/* and read every
// teacher's records.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.account) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.account.role)) {
      // Don't leak which role is needed — 'forbidden' is enough for the
      // caller, and the server log carries the exact attempt.
      console.warn(
        `[auth] role-deny account=${req.account.id} role=${req.account.role} ` +
          `wanted=${roles.join("|")} path=${req.path}`
      );
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// Returns true if the teacher's paid window has elapsed. Suspended /
// expired accounts always count as expired regardless of date math.
// Privileged roles (dev/admin/moe/owner) never expire — they don't pay,
// so the subscription gate doesn't apply to them.
const isSubscriptionExpired = (t) => {
  if (!t) return false;
  if (isPrivilegedRole(t.role)) return false;
  if (t.status === "suspended" || t.status === "deleted") return true;
  if (t.subscription_status === "expired" || t.subscription_status === "suspended") return true;
  // trial + active both rely on subscription_ends_at. A null end date
  // is treated as "open-ended" (admin extension, future Stripe annual
  // auto-renew, etc.) — let it through.
  if (!t.subscription_ends_at) return false;
  return new Date(t.subscription_ends_at).getTime() < Date.now();
};

// Express middleware. Options:
//   optional      — allow the request through without an account row
//                   (used by /api/auth/firebase since on first login
//                   the row hasn't been created yet)
//   allowExpired  — let an expired-subscription account through anyway
//                   (used by /api/auth/renew so they can pay to come
//                   back)
//   skipSessionCheck — don't enforce the single-device session match
//                   (used by the routes that ISSUE a session: the
//                   sign-in / claim endpoints, which a new device must
//                   reach even while another device holds the session)
export function requireAuth({ optional = false, allowExpired = false, skipSessionCheck = false } = {}) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || "";
      const m = header.match(/^Bearer\s+(.+)$/i);
      if (!m) {
        if (optional) return next();
        return res.status(401).json({ error: "Missing Authorization: Bearer <id_token>" });
      }
      const decoded = await verifyIdToken(m[1]);
      req.firebaseUser = decoded;
      req.account = await findAccountByUid(decoded.uid);
      if (!req.account && !optional) {
        // The token is valid but no DB row exists yet. The client should
        // call POST /api/auth/firebase first to bootstrap. We return a
        // structured 404 so the client knows to retry the bootstrap.
        return res.status(404).json({ error: "Teacher not provisioned", code: "no_teacher_row" });
      }
      if (req.account && !allowExpired && isSubscriptionExpired(req.account)) {
        // Subscription window ended. Flip status to 'expired' on first
        // detection so admin queries can see who's lapsed at a glance.
        if (req.account.subscription_status !== "expired") {
          try {
            await pool.query(
              `UPDATE accounts SET subscription_status = 'expired', updated_at = NOW() WHERE id = $1`,
              [req.account.id]
            );
            // Or the cached row keeps saying "active" and we rewrite the same
            // UPDATE on every request for the rest of the TTL.
            await invalidateAccountByUid(decoded.uid);
          } catch { /* non-fatal — middleware still rejects */ }
        }
        // Carry the plan and the end date. Once this gate closes, every
        // other route answers 403 too — so this response is the only account
        // data the client can still reach, and the lapsed screen needs it to
        // say *what* ended and *when* rather than guessing (F60). It is the
        // caller's own row; nothing here crosses a tenant boundary.
        return res.status(403).json({
          error: "Your subscription has ended.",
          code: "subscription_expired",
          plan: req.account.subscription_plan || null,
          endedAt: req.account.subscription_ends_at || null,
        });
      }
      // Single-device enforcement. The account holds the id of the one
      // session allowed to act. A newer sign-in elsewhere rotated it, so
      // a stale device's X-Session-Id no longer matches → lock it out.
      // Null active_session_id = legacy row that predates this feature;
      // let it through until its owner next signs in and claims one.
      if (req.account && !skipSessionCheck && req.account.active_session_id) {
        const sid = req.headers["x-session-id"] || null;
        if (sid !== req.account.active_session_id) {
          return res.status(401).json({
            error: "You've been signed out because this account was used on another device.",
            code: "session_superseded",
          });
        }
      }
      next();
    } catch (err) {
      const code = err?.code || err?.errorInfo?.code;
      if (code === "auth/id-token-expired") {
        return res.status(401).json({ error: "Token expired", code: "token_expired" });
      }
      return res.status(401).json({ error: `Auth failed: ${err.message}` });
    }
  };
}
