import { Router } from "express";
import { pool } from "../lib/db.js";
import { handleErr } from "../lib/helpers.js";
import { requireAuth, clientIp, userAgent, ACCOUNT_COLS_SQL, findAccountByUid } from "../lib/auth.js";
import { PLANS, TRIAL_DAYS, TRIAL_PLAN_ID, PLAN_IDS } from "../../src/lib/plans.js";
import { FirebaseBootstrapSchema, RenewSchema, validateBody } from "../lib/validate.js";
import { recordAudit } from "../lib/audit.js";
import { resolveReservedRole, isPrivilegedRole, DEFAULT_ROLE } from "../lib/roles.js";

// POST /api/auth/firebase
//
// Called by the client right after Firebase signInWithPopup() resolves
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

const planStatus = (planId) => (planId === TRIAL_PLAN_ID ? "trial" : "active");

router.post("/firebase", validateBody(FirebaseBootstrapSchema), requireAuth({ optional: true }), async (req, res) => {
  try {
    if (!req.firebaseUser) {
      return res.status(401).json({ error: "Missing Authorization: Bearer <id_token>" });
    }
    const fb = req.firebaseUser;
    const ip = clientIp(req);
    const ua = userAgent(req);
    const { plan } = req.body || {};

    // Split Firebase's `name` into first/last for our schema.
    // Falls back to email-local-part if name is missing entirely.
    const fullName = fb.name || "";
    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] || (fb.email || "Teacher").split("@")[0];
    const lastName  = parts.length > 1 ? parts.slice(1).join(" ") : "";

    let account = await findAccountByUid(fb.uid);

    // Privileged-role resolution from env (DEV_EMAILS / ADMIN_EMAILS /
    // MOE_EMAILS / OWNER_EMAILS). Privileged users don't pay — they skip
    // the plan-required gate and we stamp a far-future subscription_ends_at
    // so the auth middleware's subscription check never trips them up.
    const reservedRole = resolveReservedRole(fb.email);
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

      const ins = await pool.query(
        `INSERT INTO accounts (
            firebase_uid, email, first_name, last_name, avatar_url, role,
            subscription_status, subscription_ends_at, subscription_plan,
            last_login_at, last_login_ip, last_user_agent
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, $11)
          ON CONFLICT (email) DO UPDATE SET
            firebase_uid          = EXCLUDED.firebase_uid,
            avatar_url            = COALESCE(accounts.avatar_url, EXCLUDED.avatar_url),
            -- Env-resolved role wins on every login (env is source of
            -- truth for privileged access). For non-privileged emails
            -- (reservedRole = null) we keep the existing role.
            role                  = COALESCE($12, accounts.role),
            -- A returning user (re-using an email) keeps their old plan;
            -- the trial offer is one-per-account, not one-per-login.
            last_login_at         = NOW(),
            last_login_ip         = EXCLUDED.last_login_ip,
            last_user_agent       = EXCLUDED.last_user_agent
          RETURNING ${ACCOUNT_COLS_SQL}`,
        [fb.uid, fb.email || null, firstName, lastName, fb.picture || null, role,
         status, endsAt, planForRow, ip, ua, reservedRole]
      );
      account = ins.rows[0];
      await recordAudit({
        accountId: account.id,
        action: "auth.signup",
        targetTable: "accounts",
        targetId: account.id,
        ip, userAgent: ua,
        detail: { plan: planForRow, role, provider: fb.firebase?.sign_in_provider || null },
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
      const upd = await pool.query(
        `UPDATE accounts SET
            last_login_at   = NOW(),
            last_login_ip   = $2,
            last_user_agent = $3,
            email           = COALESCE(NULLIF($4, ''), email),
            avatar_url      = COALESCE(NULLIF($5, ''), avatar_url),
            role            = COALESCE($6, role)
          WHERE id = $1
          RETURNING ${ACCOUNT_COLS_SQL}`,
        [account.id, ip, ua, fb.email || "", fb.picture || "", reservedRole]
      );
      account = upd.rows[0];
      await recordAudit({
        accountId: account.id,
        action: "auth.login",
        targetTable: "accounts",
        targetId: account.id,
        ip, userAgent: ua,
        detail: { role: account.role, provider: fb.firebase?.sign_in_provider || null },
      });
    }

    res.json(account);
  } catch (err) {
    handleErr(res, "POST /api/auth/firebase", err);
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
    const r = await pool.query(
      `UPDATE accounts SET
          subscription_status   = $2,
          subscription_plan     = $3,
          subscription_ends_at  = $4,
          updated_at            = NOW()
        WHERE id = $1
        RETURNING ${ACCOUNT_COLS_SQL}`,
      [req.account.id, status, plan, endsAt]
    );
    await recordAudit({
      accountId: req.account.id,
      action: "auth.renew",
      targetTable: "accounts",
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

export default router;
