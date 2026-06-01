// Auth middleware — verifies the Firebase ID token on the Authorization
// header, looks the teacher up by firebase_uid, and stashes both on
// req.firebaseUser / req.teacher for downstream handlers.
//
// Routes that legitimately run unauthenticated (the marketing /healthz,
// the school catalog, and POST /api/auth/firebase itself) opt out by
// being mounted BEFORE this middleware in app.js, or by skipping the
// check via the `optional` flag.
//
// On a verified-but-unknown user (firebase_uid not yet in DB), req.teacher
// is null and downstream routes get to decide whether to upsert. The
// /api/auth/firebase route uses this to create the row on first login.
import { pool } from "./db.js";
import { verifyIdToken } from "./firebaseAdmin.js";

// Extract the client IP, honoring the X-Forwarded-For chain Render +
// Vercel add when proxying. Fall back to socket address otherwise.
export const clientIp = (req) => {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || null;
};

export const userAgent = (req) => req.headers["user-agent"] || null;

const TEACHER_COLS = `id, first_name, last_name, email, phone, staff_id, majors, grade_levels,
                       languages, sections, class_map, nationality, hire_date, bio,
                       role, status, firebase_uid, avatar_url,
                       subscription_status, subscription_ends_at, subscription_plan,
                       last_login_at, last_login_ip,
                       created_at, updated_at`;

export const TEACHER_COLS_SQL = TEACHER_COLS;

// Find the teacher row attached to a Firebase uid (or null).
export async function findTeacherByUid(uid) {
  const r = await pool.query(
    `SELECT ${TEACHER_COLS} FROM teachers WHERE firebase_uid = $1`,
    [uid]
  );
  return r.rows[0] || null;
}

// Returns true if the teacher's paid window has elapsed. Suspended /
// expired accounts always count as expired regardless of date math.
const isSubscriptionExpired = (t) => {
  if (!t) return false;
  if (t.status === "suspended" || t.status === "deleted") return true;
  if (t.subscription_status === "expired" || t.subscription_status === "suspended") return true;
  // trial + active both rely on subscription_ends_at. A null end date
  // is treated as "open-ended" (admin extension, future Stripe annual
  // auto-renew, etc.) — let it through.
  if (!t.subscription_ends_at) return false;
  return new Date(t.subscription_ends_at).getTime() < Date.now();
};

// Express middleware. Options:
//   optional      — allow the request through without a teacher row
//                   (used by /api/auth/firebase since on first login
//                   the row hasn't been created yet)
//   allowExpired  — let an expired-subscription teacher through anyway
//                   (used by /api/auth/renew so they can pay to come
//                   back)
export function requireAuth({ optional = false, allowExpired = false } = {}) {
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
      req.teacher = await findTeacherByUid(decoded.uid);
      if (!req.teacher && !optional) {
        // The token is valid but no DB row exists yet. The client should
        // call POST /api/auth/firebase first to bootstrap. We return a
        // structured 404 so the client knows to retry the bootstrap.
        return res.status(404).json({ error: "Teacher not provisioned", code: "no_teacher_row" });
      }
      if (req.teacher && !allowExpired && isSubscriptionExpired(req.teacher)) {
        // Subscription window ended. Flip status to 'expired' on first
        // detection so admin queries can see who's lapsed at a glance.
        if (req.teacher.subscription_status !== "expired") {
          try {
            await pool.query(
              `UPDATE teachers SET subscription_status = 'expired', updated_at = NOW() WHERE id = $1`,
              [req.teacher.id]
            );
          } catch { /* non-fatal — middleware still rejects */ }
        }
        return res.status(403).json({
          error: "Your subscription has ended.",
          code: "subscription_expired",
        });
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
