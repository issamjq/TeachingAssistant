/**
 * Exercise the authenticated API end to end.
 *
 * Nothing behind sign-in has ever been verified in this workstream — the
 * Admin credential only started resolving today. Rather than drive an OAuth
 * popup, this mints a custom token with the Admin SDK, exchanges it for a
 * real ID token through Firebase's REST endpoint, and calls the API exactly
 * as the browser would: Bearer token, same routes, same gates.
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";

const KEY = `${process.env.HOME}/.config/murchid/firebase-admin.json`;
const API = "http://localhost:3001";

// The browser Firebase key, read from .env.local (never hard-coded).
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const WEB_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;

const UID = "verify-migration-teacher";
const EMAIL = "verify-migration@example.test";

initializeApp({ credential: cert(JSON.parse(readFileSync(KEY, "utf8"))) });

const results = [];
const step = async (name, fn) => {
  try {
    const r = await fn();
    results.push([name, "ok", r]);
  } catch (e) {
    results.push([name, "FAIL", e.message.slice(0, 120)]);
  }
};

// 1. Mint a custom token and trade it for an ID token, the same artefact the
//    browser SDK would hold after a Google sign-in.
let idToken;
await step("mint custom token + exchange for ID token", async () => {
  await getAuth()
    .updateUser(UID, { email: EMAIL })
    .catch(() => getAuth().createUser({ uid: UID, email: EMAIL }));
  const custom = await getAuth().createCustomToken(UID);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    }
  );
  const j = await res.json();
  if (!j.idToken) throw new Error(JSON.stringify(j).slice(0, 160));
  idToken = j.idToken;
  return "token acquired";
});

// Single-device sign-in: the bootstrap claims a session and every later
// request must echo its id. Omitting it is indistinguishable from a stale
// device and the server correctly answers 401 — which is what the first run
// of this script proved.
let sessionId = null;
const call = (path, opts = {}) =>
  fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${idToken}`,
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

// 3. Bootstrap provisions the account row (what the sign-up funnel does).
await step("POST /api/auth/firebase provisions account", async () => {
  const r = await call("/api/auth/firebase", {
    method: "POST",
    body: JSON.stringify({ plan: "trial" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 120)}`);
  sessionId = j.active_session_id || null;
  return `role=${j.role} status=${j.subscription_status} session=${sessionId ? "claimed" : "none"}`;
});

// 4. The authenticated surfaces the studio actually calls on load.
for (const p of ["/api/me", "/api/auth/me", "/api/drafts", "/api/templates", "/api/students", "/api/schedule", "/api/quizzes", "/api/dashboard"]) {
  await step(`GET ${p}`, async () => {
    const r = await call(p);
    if (!r.ok) throw new Error(`${r.status}`);
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? `200 · ${j.length} rows` : "200";
  });
}

// 5. Role gate: a teacher must NOT reach dev-only routes.
await step("teacher blocked from /api/dev/* (403)", async () => {
  const r = await call("/api/dev/flags");
  if (r.status !== 403) throw new Error(`expected 403, got ${r.status}`);
  return "403";
});

const pad = (s, n) => String(s).padEnd(n);
console.log("\n" + pad("CHECK", 44) + pad("RESULT", 8) + "DETAIL");
console.log("-".repeat(96));
for (const [n, s, d] of results) console.log(pad(n, 44) + pad(s, 8) + d);
const failed = results.filter((r) => r[1] !== "ok").length;
console.log(`\n${results.length - failed}/${results.length} passed`);

await getAuth().deleteUser(UID).catch(() => {});
process.exit(failed ? 1 : 0);
