# 00 · Setup — the skeleton every other file builds on

Do this first. Files 01–06 each add one router and assume everything here
exists.

## What this service is for

Five things the browser cannot do, because each needs a secret or a
privilege. Everything else in Murchid already goes from the browser
straight to Supabase, authorised by Row Level Security — see
`src/lib/data/` in the frontend repo.

| File | Feature | Why it cannot be client-side |
|---|---|---|
| [01](01-ai-studio.md) | AI generation | holds the model API key |
| [02](02-document-parsing.md) | CV / staff-ID reading | same key |
| [03](03-email-verification.md) | Sign-up codes | mail credentials, bcrypt, a table no client can read |
| [04](04-admin-consoles.md) | Admin / owner / dev consoles | reads across all teachers; writes `audit_log` |
| [05](05-images.md) | Image upload | serves stored bytes |
| [06](06-assistant.md) | Studio assistant *(optional)* | model key + tool calling |

---

## Project

```bash
mkdir murchid-api && cd murchid-api
npm init -y
npm i express cors helmet compression express-rate-limit pg jose zod dotenv
npm i bcryptjs resend            # 03 only
npm i -D nodemon
```

`package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "node --env-file-if-exists=.env --watch src/index.js",
    "start": "node src/index.js"
  }
}
```

```
src/
  index.js          boot
  app.js            middleware + router mounting
  lib/
    db.js           Postgres pool
    auth.js         token verification
    audit.js        audit_log writer
    errors.js       one error shape
  routes/
    studio.js  onboarding.js  auth.js  admin.js  images.js  chat.js
```

---

## `src/lib/db.js`

```js
import pg from "pg";

// The SUPAVISOR POOLER string, port 6543 — not the direct one.
// db.<ref>.supabase.co resolves to IPv6 only and most hosts cannot reach it.
// Dashboard → Connect → Transaction pooler.
//
// Do NOT append sslmode=require. This pg version reads it as verify-full,
// which then fails against the system trust store. Pin Supabase's CA instead
// (copy db/supabaseCa.js from the frontend repo — it is 50 lines).
import { SUPABASE_CA, isSupabaseHost } from "./supabaseCa.js";

const { Pool } = pg;
const url = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString: url,
  ssl: isSupabaseHost(url) ? { ca: SUPABASE_CA } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => console.error("[db] idle client error", err.message));
```

This connection is **not** subject to RLS. That is the point — it is how
the consoles read across teachers and how `audit_log` gets written. It
also means every query here must scope itself by hand; there is no policy
catching a mistake.

---

## `src/lib/auth.js`

```js
import { createRemoteJWKSet, jwtVerify } from "jose";
import { pool } from "./db.js";

// Verify against the project's PUBLIC keys. No service-role key, and no
// shared JWT secret: a shared secret would let this process MINT tokens
// rather than merely check them, which is a much larger thing to leak.
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${process.env.SUPABASE_URL}/auth/v1`,
  });
  return {
    uid: payload.sub,
    email: payload.email,
    sessionId: payload.session_id,   // used by the single-device check
    provider: payload.app_metadata?.provider,
  };
}

/**
 * The teacher behind a token: users + faculty + subscriptions, flattened.
 *
 * `id` is the FACULTY id, because that is what every teacher-owned table
 * references. `user_id` is the identity — notices and sessions hang off it.
 * Getting those the wrong way round is the mistake that looks like it worked.
 */
const TEACHER = `
  SELECT f.id, u.id AS user_id, u.email, u.first_name, u.last_name,
         u.role, u.sub_role, u.account_status AS status, u.active_session_id,
         f.faculty_code, f.expertise AS majors, f.eligible_grades AS grade_levels,
         s.plan AS subscription_plan, s.status AS subscription_status
    FROM faculty f
    JOIN users u ON u.id = f.user_id
    LEFT JOIN subscriptions s ON s.faculty_id = f.id
   WHERE u.id = $1`;

export function requireAuth({ optional = false, requireTeacher = true } = {}) {
  return async (req, res, next) => {
    try {
      const m = (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
      if (!m) {
        if (optional) return next();
        return res.status(401).json({ error: "Missing Authorization: Bearer <token>" });
      }
      req.authUser = await verifyToken(m[1]);

      const { rows } = await pool.query(TEACHER, [req.authUser.uid]);
      req.account = rows[0] || null;

      // No faculty row yet. Onboarding legitimately runs in this state,
      // so it is a flag rather than an error.
      if (!req.account && requireTeacher) {
        return res.status(404).json({ error: "Teacher not provisioned", code: "no_teacher_row" });
      }

      // Single-device: the database enforces this on everything the
      // browser does directly, so enforce the same rule here or this
      // service becomes the way around it.
      if (req.account?.active_session_id &&
          req.account.active_session_id !== req.authUser.sessionId) {
        return res.status(401).json({
          error: "You've been signed out because this account was used on another device.",
          code: "session_superseded",
        });
      }
      next();
    } catch (err) {
      res.status(401).json({ error: `Auth failed: ${err.message}` });
    }
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.account) return res.status(401).json({ error: "Not authenticated" });
    if (!roles.includes(req.account.role)) {
      // Do not leak which role is needed. The server log carries the attempt.
      console.warn(`[auth] deny ${req.account.id} role=${req.account.role} path=${req.path}`);
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export const clientIp = (req) =>
  String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || null;
```

---

## `src/lib/errors.js`

```js
/**
 * One error shape, because the frontend branches on `code`, not on prose.
 * Never send err.message from a database error to a client: it leaks
 * column names, and occasionally values.
 */
export function handleErr(res, where, err) {
  const id = Math.random().toString(36).slice(2, 10);
  console.error(`[${where}] ${id}`, err);
  res.status(err.status || 500).json({
    error: err.expose ? err.message : "Something went wrong.",
    code: err.code,
    errorId: id,
  });
}

export const bad = (message, code) =>
  Object.assign(new Error(message), { status: 400, expose: true, code });
```

---

## `src/lib/audit.js`

```js
import { pool } from "./db.js";

// audit_log has RLS enabled and NO policy, so no client can read or write
// it. This connection can, because it is not subject to RLS.
//
// Do not put names, emails or addresses in `meta`. It is for forensics,
// not analytics — link with actor_id and entity_id instead.
export async function recordAudit({
  actorId = null, action, entity = null, entityId = null,
  ip = null, userAgent = null, meta = null,
} = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_id, action, entity, entity_id, ip, user_agent, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [actorId, action, entity, entityId, ip,
       userAgent ? String(userAgent).slice(0, 500) : null,
       meta ? JSON.stringify(meta) : null]
    );
  } catch (err) {
    // An audit failure must never break the request it describes.
    console.error("[audit]", err.message);
  }
}
```

---

## `src/app.js`

```js
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole } from "./lib/auth.js";

export function buildApp() {
  const app = express();
  app.set("trust proxy", 1);            // behind a platform proxy; needed for real IPs
  app.use(helmet());
  app.use(compression());

  // Allowlist, never `*`. With credentials, `*` is refused by browsers
  // anyway, and silently allowing every origin is how a token gets used
  // from somewhere it should not be.
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  app.use(cors({
    origin: (origin, cb) =>
      !origin || allowed.includes(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS")),
    credentials: true,
  }));

  // 25 MB: a CV as base64 is ~1.33x its size, and the cap for one is 5 MB.
  app.use(express.json({ limit: "25mb" }));
  app.use(rateLimit({ windowMs: 5 * 60_000, limit: 300 }));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // Mount order matters. Anything reachable before a teacher row exists
  // goes above the strict gate.
  app.use("/api/auth", authRouter);                                  // 03
  app.use("/api/onboarding", requireAuth({ requireTeacher: false }), onboardingRouter); // 02

  app.use("/api", requireAuth());       // from here: valid token AND a teacher row

  app.use("/api/studio", studioRouter);                              // 01
  app.use("/api/images", imagesRouter);                              // 05
  app.use("/api/chat", chatRouter);                                  // 06

  app.use("/api/admin",      requireRole("admin","super_admin","dev"), adminRouter);      // 04
  app.use("/api/superadmin", requireRole("super_admin","dev"),         superadminRouter);
  app.use("/api/owner",      requireRole("owner","super_admin","dev"), ownerRouter);
  app.use("/api/moe",        requireRole("moe","super_admin","dev"),   moeRouter);
  app.use("/api/dev",        requireRole("dev"),                       devRouter);

  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  return app;
}
```

## `src/index.js`

```js
import "dotenv/config";
import { buildApp } from "./app.js";

for (const k of ["DATABASE_URL", "SUPABASE_URL"]) {
  if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(1); }
}

const port = Number(process.env.PORT) || 3001;
buildApp().listen(port, () => console.log(`[murchid-api] :${port}`));
```

**Do not run migrations at boot.** The old API rebuilt the schema on every
start; it is authored in Supabase now, and `db/tune.sql` in the frontend
repo is applied deliberately by hand.

---

## Environment

```bash
DATABASE_URL=postgresql://postgres.REF:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://REF.supabase.co
ALLOWED_ORIGINS=https://murchid.com,http://localhost:3000
GEMINI_API_KEY=...            # or ANTHROPIC_API_KEY
RESEND_API_KEY=...            # 03 only
PORT=3001
```

**No service-role key.** A leaked service key mints tokens; the public
JWKS only verifies them. If admin work later needs one, keep it in a
process no request can reach.

---

## Connecting it to the frontend

Set `API_PROXY_TARGET` to this service's origin in the Vercel project.
Next rewrites `/api/*` to it server-side, so the browser stays
same-origin and there is no preflight.

Unset, there is no rewrite and those paths 404 — which the frontend
reports as "this part of Murchid needs the API service, which isn't
connected yet". That is deliberate.

`SERVER_ONLY` in `src/lib/data/index.ts` is the authoritative list of what
reaches you. **Anything not in it is answered from Supabase and must not
be implemented here** — a second implementation is a second answer.

---

## Before you write a query

- **Nothing here is protected by RLS.** Every query scopes itself by hand.
- **A view over three tables is not updatable.** `accounts`, `drafts`,
  `quizzes` and friends are reporting views; read them, write to `users`,
  `faculty` and `subscriptions`.
- **An admin cannot create a teacher.** `users.id` is FK'd to
  `auth.users`; minting one needs a service-role key. Attach a role to
  someone who has already signed up, and say so when they have not.
- **Do not write `ai_studio`, `students`, `schedule_entries` or any other
  teacher-owned table.** The browser owns those. Two writers means two
  ideas of what the shape is.
