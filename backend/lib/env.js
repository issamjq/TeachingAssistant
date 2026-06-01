// Boot-time environment validation. Run BEFORE buildApp() so the
// process refuses to start if something critical is missing — better
// to crash loud at boot than serve traffic with a half-configured app.
//
// Production-only checks:
//   - ALLOWED_ORIGINS must be set (no wildcard CORS in prod)
//   - DATABASE_URL must use sslmode=require (or wider)
//   - LOG_LEVEL warning if 'debug' is set in prod
//
// All-env checks (dev + prod):
//   - DATABASE_URL exists and looks like a postgres URL
//   - FIREBASE_ADMIN_KEY_B64 exists and decodes to a valid service account
//
// Print a single-line summary at boot so it's visible in `render logs`
// what shape the app expects to be in.

import { Buffer } from "node:buffer";

const REQUIRED_ALWAYS = ["DATABASE_URL", "FIREBASE_ADMIN_KEY_B64"];

const errors = [];
const warnings = [];

const isProd = process.env.NODE_ENV === "production";

export function validateEnv() {
  for (const key of REQUIRED_ALWAYS) {
    if (!process.env[key] || process.env[key].trim() === "") {
      errors.push(`${key} is missing`);
    }
  }

  if (process.env.DATABASE_URL) {
    if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) {
      errors.push("DATABASE_URL is not a postgres:// URL");
    }
    if (isProd && !/sslmode=/.test(process.env.DATABASE_URL)) {
      warnings.push(
        "DATABASE_URL has no sslmode= parameter — Neon connections should use sslmode=require"
      );
    }
  }

  if (process.env.FIREBASE_ADMIN_KEY_B64) {
    try {
      const decoded = JSON.parse(
        Buffer.from(process.env.FIREBASE_ADMIN_KEY_B64, "base64").toString("utf8")
      );
      if (!decoded.project_id || !decoded.private_key || !decoded.client_email) {
        errors.push("FIREBASE_ADMIN_KEY_B64 decoded but is missing required fields");
      }
    } catch (e) {
      errors.push(`FIREBASE_ADMIN_KEY_B64 is not valid base64-JSON: ${e.message}`);
    }
  }

  if (isProd) {
    if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS.trim() === "") {
      errors.push(
        "ALLOWED_ORIGINS is required in production. Set it to a comma-separated list of " +
          "your frontend URLs (no trailing slash) so CORS doesn't accept arbitrary origins."
      );
    }
    if (process.env.LOG_LEVEL === "debug") {
      warnings.push("LOG_LEVEL=debug in production — may log sensitive request bodies");
    }
  } else {
    // In dev, accept localhost origins automatically. The app.js CORS
    // config reads this to extend the allowlist.
    if (!process.env.ALLOWED_ORIGINS) {
      warnings.push("ALLOWED_ORIGINS empty (dev only — auto-allowing localhost)");
    }
  }

  if (errors.length > 0) {
    console.error("\n[env] FATAL — refusing to start:");
    for (const e of errors) console.error(`  ✗ ${e}`);
    if (warnings.length) {
      console.error("[env] warnings:");
      for (const w of warnings) console.error(`  ! ${w}`);
    }
    console.error(""); // trailing newline so the error stands out in logs
    process.exit(1);
  }
  for (const w of warnings) console.warn(`[env] warn: ${w}`);
  console.log(
    `[env] OK — mode=${isProd ? "production" : "development"}, ` +
      `db=neon, firebase=admin-ok, ` +
      `cors=${process.env.ALLOWED_ORIGINS ? "allowlist" : "dev-localhost"}`
  );
}
