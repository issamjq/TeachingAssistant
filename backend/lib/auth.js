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

// Find the account row attached to a Firebase uid (or null).
export async function findAccountByUid(uid) {
  const r = await pool.query(
    `SELECT ${ACCOUNT_COLS} FROM accounts WHERE firebase_uid = $1`,
    [uid]
  );
  return r.rows[0] || null;
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
          } catch { /* non-fatal — middleware still rejects */ }
        }
        return res.status(403).json({
          error: "Your subscription has ended.",
          code: "subscription_expired",
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
