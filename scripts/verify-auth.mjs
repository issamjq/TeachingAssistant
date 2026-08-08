/**
 * Exercise the authenticated API end to end, against Supabase Auth.
 *
 * Rather than drive an OAuth redirect, this creates a pre-confirmed user
 * with the Admin API, signs in as them for a real access token, and calls
 * the API exactly as the browser would: Bearer token, same routes, same
 * gates. The user is deleted again on the way out.
 *
 * Requires SUPABASE_SECRET_KEY — the only step that needs privilege is
 * creating/deleting the throwaway user. The API being tested never sees
 * that key; it verifies the access token against the public JWKS.
 *
 *   SUPABASE_SECRET_KEY=sb_secret_… npm run verify:auth
 *
 * (Previously this minted a Firebase custom token via the Admin SDK.)
 */
import { readFileSync } from "node:fs";

const API = "http://localhost:3001";

// Read .env for the project URL + publishable key so nothing is hard-coded.
// Falls back to the real environment, which is how CI would supply them.
function loadEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
    );
  } catch {
    return {};
  }
}
const env = { ...loadEnv(".env"), ...loadEnv(".env.local"), ...process.env };

const SUPABASE_URL = (
  env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ""
).replace(/\/$/, "");
const PUBLISHABLE = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !PUBLISHABLE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env"
  );
  process.exit(2);
}
if (!SECRET) {
  console.error(
    "Missing SUPABASE_SECRET_KEY.\n" +
      "Needed only to create and delete the throwaway test user.\n" +
      "Get it from the Supabase dashboard → Project Settings → API keys → secret."
  );
  process.exit(2);
}

const EMAIL = `verify-auth+${Date.now()}@murchid.test`;
const PASSWORD = `vf-${Math.random().toString(36).slice(2)}-Aa1!`;

const admin = (path, opts = {}) =>
  fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...opts,
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });

const results = [];
const step = async (name, fn) => {
  try {
    results.push([name, "ok", await fn()]);
  } catch (e) {
    results.push([name, "FAIL", String(e.message).slice(0, 120)]);
  }
};

// 1. Create a confirmed user and sign in — the same artefact the browser
//    holds after a real sign-in. email_confirm skips the inbox round-trip
//    (this project has mailer_autoconfirm off).
let accessToken;
let userId;
await step("create test user + sign in for access token", async () => {
  const created = await admin("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Verify Auth" },
    }),
  });
  const cu = await created.json().catch(() => ({}));
  if (!created.ok) throw new Error(`admin create ${created.status}: ${JSON.stringify(cu).slice(0, 140)}`);
  userId = cu.id;

  const signIn = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const j = await signIn.json().catch(() => ({}));
  if (!j.access_token) throw new Error(JSON.stringify(j).slice(0, 160));
  accessToken = j.access_token;
  return `uid=${userId?.slice(0, 8)}…`;
});

// Single-device sign-in: the bootstrap claims a session and every later
// request must echo its id. Omitting it is indistinguishable from a stale
// device and the server correctly answers 401.
let sessionId = null;
const call = (path, opts = {}) =>
  fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(sessionId ? { "X-Session-Id": sessionId } : {}),
      ...(opts.headers || {}),
    },
  });

// 2. Unauthenticated must be rejected — proves the gate is real.
await step("no token → 401", async () => {
  const r = await fetch(`${API}/api/me`);
  if (r.status !== 401) throw new Error(`got ${r.status}`);
  return "401";
});

// 3. A token this project didn't sign must be rejected — proves the JWKS
//    signature check runs, not just a claims check.
await step("forged token → 401", async () => {
  const [h, p] = accessToken.split(".");
  const r = await fetch(`${API}/api/me`, {
    headers: { Authorization: `Bearer ${h}.${p}.ZmFrZXNpZ25hdHVyZQ` },
  });
  if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
  return "401";
});

// 4. Bootstrap provisions the account row (what the sign-up funnel does).
await step("POST /api/auth/supabase provisions account", async () => {
  const r = await call("/api/auth/supabase", {
    method: "POST",
    body: JSON.stringify({ plan: "trial" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 120)}`);
  sessionId = j.active_session_id || null;
  return `role=${j.role} status=${j.subscription_status} session=${sessionId ? "claimed" : "none"}`;
});

// 5. The authenticated surfaces the studio actually calls on load.
for (const p of ["/api/me", "/api/auth/me", "/api/drafts", "/api/templates", "/api/students", "/api/schedule", "/api/quizzes", "/api/dashboard"]) {
  await step(`GET ${p}`, async () => {
    const r = await call(p);
    if (!r.ok) throw new Error(`${r.status}`);
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? `200 · ${j.length} rows` : "200";
  });
}

// 6. Role gate: a teacher must NOT reach dev-only routes.
await step("teacher blocked from /api/dev/* (403)", async () => {
  const r = await call("/api/dev/flags");
  if (r.status !== 403) throw new Error(`expected 403, got ${r.status}`);
  return "403";
});

const pad = (s, n) => String(s).padEnd(n);
console.log("\n" + pad("CHECK", 46) + pad("RESULT", 8) + "DETAIL");
console.log("-".repeat(98));
for (const [n, s, d] of results) console.log(pad(n, 46) + pad(s, 8) + d);
const failed = results.filter((r) => r[1] !== "ok").length;
console.log(`\n${results.length - failed}/${results.length} passed`);

// Clean up: drop the Supabase user and the account row it provisioned, so
// re-running doesn't accumulate junk in either system.
if (userId) {
  await admin(`/admin/users/${userId}`, { method: "DELETE" }).catch(() => {});
  try {
    const { pool } = await import("../backend/lib/db.js");
    await pool.query("DELETE FROM accounts WHERE email = $1", [EMAIL]);
    await pool.end();
  } catch { /* best effort */ }
}
process.exit(failed ? 1 : 0);
