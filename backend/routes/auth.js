import { Router } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { requireAuth, clientIp, userAgent, findAccountByUid } from "../lib/auth.js";
import { ensureTeacher, findTeacherById } from "../lib/teacher.js";
import { PLANS, TRIAL_DAYS, TRIAL_PLAN_ID, PLAN_IDS } from "../../src/lib/plans.js";
import { SupabaseBootstrapSchema, RenewSchema, validateBody } from "../lib/validate.js";
import { recordAudit } from "../lib/audit.js";
import { resolveReservedRole, isPrivilegedRole, DEFAULT_ROLE } from "../lib/roles.js";
import { sendVerificationCode } from "../lib/email.js";

// POST /api/auth/supabase
//
// Called by the client right after Supabase sign-in resolves
// AND a plan has been picked in the onboarding wizard. Required body:
//   { plan: "trial" | "monthly" | "quarterly" | "annual" }
//
// On first login the account row is created with the plan's real
// duration: trial = 7 days, monthly = 30, quarterly = 90, annual = 365.
// Subsequent logins refresh the audit fields but DO NOT extend the
// subscription (that has to come from a payment / admin extension).
//
// The Authorization header is required even for first-time sign-in —
// the middleware verifies the token. Every successful call stamps
// last_login_at / last_login_ip / last_user_agent for the audit trail.
const router = Router();

// Plan id → days to add to NOW() for subscription_ends_at. Built from
// the same lib/plans.js the client uses so both sides agree.
const PLAN_DURATION = {
  [TRIAL_PLAN_ID]: TRIAL_DAYS,
  ...Object.fromEntries(PLANS.map((p) => [p.id, p.durationDays])),
};

// 'trialing', not 'trial' — the subscriptions table uses Stripe's
// vocabulary, which is also what its own default says. The plan is named
// 'trial'; the STATUS of being on it is 'trialing'.
const planStatus = (planId) => (planId === TRIAL_PLAN_ID ? "trialing" : "active");

// Rotate the account's single active session to a fresh id (single-device
// sign-in). Returns the new id so the caller can hand it to the client,
// which echoes it on every request via X-Session-Id. Any other device's
// stored id is now stale and its next request is rejected.
async function claimSession(teacher) {
  const sessionId = randomUUID();
  // The session belongs to the person, so it lives on users — a teacher
  // signing in is the same human whether or not they have a faculty row.
  await pool.query(
    `UPDATE users SET active_session_id = $2, updated_at = now() WHERE id = $1`,
    [teacher.user_id, sessionId]
  );
  return sessionId;
}

router.post("/supabase", validateBody(SupabaseBootstrapSchema), requireAuth({ optional: true, skipSessionCheck: true }), async (req, res) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ error: "Missing Authorization: Bearer <id_token>" });
    }
    const au = req.authUser;
    const ip = clientIp(req);
    const ua = userAgent(req);
    const { plan } = req.body || {};

    // Split the provider's display name into first/last for our schema.
    // Falls back to email-local-part if name is missing entirely.
    const fullName = au.name || "";
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || (au.email || "Teacher").split("@")[0];
    const lastName  = parts.length > 1 ? parts.slice(1).join(" ") : "";

    let account = await findAccountByUid(au.uid);

    // Privileged-role resolution from env (DEV_EMAILS / ADMIN_EMAILS /
    // MOE_EMAILS / OWNER_EMAILS). Privileged users don't pay — they skip
    // the plan-required gate and we stamp a far-future subscription_ends_at
    // so the auth middleware's subscription check never trips them up.
    const reservedRole = resolveReservedRole(au.email);
    const isPrivileged = isPrivilegedRole(reservedRole);

    if (!account) {
      // First login.
      //
      // Teachers: a plan is REQUIRED — without it we have no way to set
      // subscription_ends_at, and they shouldn't enter the studio without
      // committing to a plan (or the 7-day trial). The client only calls
      // this endpoint after the plan picker, so a missing/invalid plan
      // is either a programming error OR a user trying to bypass the
      // funnel; either way, reject.
      //
      // Privileged roles (dev/admin/moe/owner): skip the plan picker
      // entirely — they don't pay, the env list IS their authorization.
      let role = reservedRole || DEFAULT_ROLE;
      let status, endsAt, planForRow;
      if (isPrivileged) {
        status = "active";
        endsAt = new Date(Date.now() + 365 * 86400000 * 100); // 100y
        planForRow = null;
      } else {
        if (!plan || !PLAN_IDS.includes(plan)) {
          return res.status(400).json({
            error: "Plan required to provision account. Pick a plan before signing in.",
            code: "plan_required",
          });
        }
        const days = PLAN_DURATION[plan];
        endsAt = new Date(Date.now() + days * 86400000);
        status = planStatus(plan);
        planForRow = plan;
      }

      // The three rows a teacher needs, created together. What used to
      // be one INSERT ... ON CONFLICT (email) is now users + faculty +
      // subscriptions — and note the conflict key moved: identity is the
      // auth uid, never the email. Two providers can hand over the same
      // address, and merging on it would have joined two people.
      account = await ensureTeacher(
        { ...au, firstName, lastName },
        { trialDays: isPrivileged ? 36500 : (PLAN_DURATION[plan] ?? TRIAL_DAYS) }
      );
      if (!account) return res.status(400).json({ error: "Could not provision account." });

      await pool.query(
        `UPDATE subscriptions
            SET plan = $2, status = $3, current_period_end = $4, updated_at = now()
          WHERE faculty_id = $1`,
        [account.id, planForRow ?? "trial", status, endsAt]
      );
      await pool.query(
        `UPDATE users
            SET role = COALESCE($2, role), last_login_at = now(), last_login_ip = $3
          WHERE id = $1`,
        [account.user_id, reservedRole, ip]
      );
      account = await findTeacherById(account.id);
      await recordAudit({
        accountId: account.user_id,
        action: "auth.signup",
        targetTable: "faculty",
        targetId: account.id,
        ip, userAgent: ua,
        detail: { plan: planForRow, role, provider: au.provider || null },
      });
    } else {
      // Returning user — stamp the audit fields + bump the avatar/email
      // if Google's / Microsoft's version is newer than what we have.
      // We do NOT extend the subscription here; that has to come from
      // a paid renewal (future Stripe flow) or an admin extension.
      //
      // Env-resolved role wins on every login. If the email is no longer
      // in any privileged list, role is left as-is (no silent demotion
      // of an admin/dev row that was assigned via env earlier — fix
      // demotion explicitly by re-running db:init or via admin route).
      // Self-heal the rows a teacher needs. ensureTeacher only runs on
      // first sign-in, so an account provisioned before credits existed
      // would never gain one — and a null balance reads as "unknown"
      // rather than "none".
      await pool.query(
        `INSERT INTO credits (faculty_id, balance, monthly_allowance)
         SELECT $1, 200, 200
          WHERE NOT EXISTS (SELECT 1 FROM credits WHERE faculty_id = $1)`,
        [account.id]
      );
      await pool.query(
        `UPDATE users SET
            last_login_at = now(),
            last_login_ip = $2,
            email         = COALESCE(NULLIF($3, ''), email),
            avatar_url    = COALESCE(NULLIF($4, ''), avatar_url),
            role          = COALESCE($5, role),
            updated_at    = now()
          WHERE id = $1`,
        [account.user_id, ip, au.email || "", au.picture || "", reservedRole]
      );
      account = await findTeacherById(account.id);
      await recordAudit({
        accountId: account.user_id,
        action: "auth.login",
        targetTable: "faculty",
        targetId: account.id,
        ip, userAgent: ua,
        detail: { role: account.role, provider: au.provider || null },
      });
    }

    // Claim the single active session for the device that just signed in.
    const sessionId = await claimSession(account);
    res.json({ ...account, active_session_id: sessionId });
  } catch (err) {
    handleErr(res, "POST /api/auth/supabase", err);
  }
});

// POST /api/auth/claim-session
//
// Called by the returning-user sign-in fast path (an already-provisioned
// teacher signing in again, possibly on a new device). Rotates the active
// session to this device and returns the account + new session id. Uses
// skipSessionCheck so a new device can claim even while another device
// still holds the session — that's the whole point of single-device
// sign-in. A 404 (no teacher row) tells the client this is a brand-new
// user who should go through the profile + plan funnel instead.
router.post("/claim-session", requireAuth({ skipSessionCheck: true }), async (req, res) => {
  try {
    const sessionId = await claimSession(req.account);
    res.json({ ...req.account, active_session_id: sessionId });
  } catch (err) {
    handleErr(res, "POST /api/auth/claim-session", err);
  }
});

// POST /api/auth/renew — existing teacher picks (or re-picks) a paid
// plan. Sets status='active' (or 'trial' if they re-pick trial — though
// the UI shouldn't let them re-trial once they've used it), pushes
// ends_at out by the plan's full duration. Bypasses the subscription
// gate via requireAuth() with allowExpired: true so an expired teacher
// can use this to come back. Pre-Stripe; later this is what the
// successful Checkout webhook will call internally.
router.post("/renew", validateBody(RenewSchema), requireAuth({ allowExpired: true }), async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!plan || !PLAN_IDS.includes(plan)) {
      return res.status(400).json({ error: "Valid plan required", code: "plan_required" });
    }
    const days = PLAN_DURATION[plan];
    const endsAt = new Date(Date.now() + days * 86400000);
    const status = planStatus(plan);
    await pool.query(
      `UPDATE subscriptions SET
          status             = $2,
          plan               = $3,
          current_period_end = $4,
          updated_at         = now()
        WHERE faculty_id = $1`,
      [req.account.id, status, plan, endsAt]
    );
    const r = { rows: [await findTeacherById(req.account.id)] };
    await recordAudit({
      accountId: req.account.user_id,
      action: "auth.renew",
      targetTable: "faculty",
      targetId: req.account.id,
      ip: clientIp(req), userAgent: userAgent(req),
      detail: { plan, prevStatus: req.account.subscription_status },
    });
    res.json(r.rows[0]);
  } catch (err) {
    handleErr(res, "POST /api/auth/renew", err);
  }
});

// GET /api/auth/me — convenience for the client to fetch the canonical
// account record using only the Bearer token (no body). Used on app
// boot to verify the token is still good and hydrate the sidebar.
router.get("/me", requireAuth(), async (req, res) => {
  try {
    res.json(req.account);
  } catch (err) {
    handleErr(res, "GET /api/auth/me", err);
  }
});

// ── 6-digit email verification (sign-up only) ─────────────────────────
//
// Replaces Firebase's emailVerified link flow with a code the user
// types into the app — link flows confused teachers because the link
// opens a Firebase "verified ✓" page and they don't know to come back
// to the original tab.
//
// Codes are bcrypt-hashed at rest, expire in 5 minutes, accept up to
// 5 attempts each, and are invalidated when a new one is requested
// (so the most recent /send always wins). The Firebase ID token
// supplies the email — we never trust an email from the request body.

const VERIFY_CODE_TTL_MS = 60 * 1000;            // 1 minute
const VERIFY_RESEND_COOLDOWN_MS = 30 * 1000;     // 30s between sends
const VERIFY_MAX_ATTEMPTS = 5;

router.post("/email-verify/send", requireAuth({ optional: true }), async (req, res) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ error: "Missing Authorization: Bearer <id_token>" });
    }
    const email = (req.authUser.email || "").toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Access token has no email." });
    }

    // Throttle: refuse if a code was issued in the last 30 seconds.
    // Looks at the most recent UNCONSUMED row only — once a code is
    // used or expired, the timer resets.
    const recent = await pool.query(
      `SELECT created_at FROM email_verifications
        WHERE email = $1 AND consumed_at IS NULL
        ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (recent.rows[0]) {
      const since = Date.now() - new Date(recent.rows[0].created_at).getTime();
      if (since < VERIFY_RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((VERIFY_RESEND_COOLDOWN_MS - since) / 1000);
        return res.status(429).json({
          error: `Wait ${waitSec}s before requesting another code.`,
          retryAfter: waitSec,
        });
      }
    }

    // Cryptographically-uniform 6-digit code. crypto.randomInt would
    // be slightly better, but Math.random + range is fine for one-shot
    // OTPs that get bcrypted and rate-limited downstream.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expires = new Date(Date.now() + VERIFY_CODE_TTL_MS);

    // Drop any previous unconsumed code for this email so only the
    // newest code can be redeemed. Avoids a user juggling two codes
    // and the older one accidentally succeeding.
    await pool.query(
      `DELETE FROM email_verifications
        WHERE email = $1 AND consumed_at IS NULL`,
      [email]
    );
    await pool.query(
      `INSERT INTO email_verifications (email, code_hash, expires_at)
        VALUES ($1, $2, $3)`,
      [email, codeHash, expires]
    );

    try {
      await sendVerificationCode({ to: email, code });
    } catch (err) {
      console.error("[email-verify/send] sender failed:", err);
      return res.status(502).json({
        error: "Could not send the email. Try again in a moment.",
      });
    }
    res.json({ ok: true, expiresAt: expires.toISOString() });
  } catch (err) {
    handleErr(res, "POST /api/auth/email-verify/send", err);
  }
});

router.post("/email-verify/check", requireAuth({ optional: true }), async (req, res) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ error: "Missing Authorization: Bearer <id_token>" });
    }
    const email = (req.authUser.email || "").toLowerCase();
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Code must be 6 digits." });
    }

    const r = await pool.query(
      `SELECT id, code_hash, expires_at, attempts, consumed_at
         FROM email_verifications
        WHERE email = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [email]
    );
    const row = r.rows[0];
    if (!row) {
      return res.status(400).json({ error: "No code found — request a new one." });
    }
    if (row.consumed_at) {
      return res.status(400).json({ error: "Code already used — request a new one." });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "Code expired — request a new one." });
    }
    if (row.attempts >= VERIFY_MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Too many wrong attempts — request a new code." });
    }

    const ok = await bcrypt.compare(code, row.code_hash);
    if (!ok) {
      await pool.query(
        `UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1`,
        [row.id]
      );
      const left = VERIFY_MAX_ATTEMPTS - (row.attempts + 1);
      return res.status(400).json({
        error: left > 0
          ? `Wrong code — ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many wrong attempts — request a new code.",
      });
    }

    await pool.query(
      `UPDATE email_verifications SET consumed_at = NOW() WHERE id = $1`,
      [row.id]
    );
    // Lazy cleanup so the table doesn't grow forever. Keeps a 1-day
    // tail in case we want to look at recent verification activity.
    await pool.query(
      `DELETE FROM email_verifications
        WHERE expires_at < NOW() - interval '1 day'`
    );
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "POST /api/auth/email-verify/check", err);
  }
});

export default router;
