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
//   - SUPABASE_URL exists and looks like a Supabase project URL
//
// Print a single-line summary at boot so it's visible in `render logs`
// what shape the app expects to be in.

import { isSupabaseHost } from "./supabaseCa.js";

// SUPABASE_URL is checked separately (NEXT_PUBLIC_SUPABASE_URL is
// accepted as a fallback so a single .env serves both processes).
const REQUIRED_ALWAYS = ["DATABASE_URL"];

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
    // TLS. Supabase hosts are handled in lib/db.js by pinning the
    // Supabase root CA (sslmode= in the URL would be wrong there — this
    // pg version reads require as verify-full, which the Supabase chain
    // fails against the system trust store). Any OTHER provider still
    // relies on the connection string to turn TLS on, and omitting it
    // means plaintext, so keep warning in that case.
    if (
      isProd &&
      !isSupabaseHost(process.env.DATABASE_URL) &&
      !/sslmode=/.test(process.env.DATABASE_URL)
    ) {
      warnings.push(
        "DATABASE_URL has no sslmode= parameter — non-Supabase Postgres connections should use sslmode=require"
      );
    }
  }

  // Supabase Auth. The API only ever VERIFIES tokens, against the
  // project's public JWKS — so the one thing it must know is which
  // project to trust. No service-account file, no base64 blob, and
  // deliberately no JWT secret (a shared secret would let this process
  // mint tokens, not just check them).
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.trim() === "") {
    errors.push(
      "SUPABASE_URL is missing. Set SUPABASE_URL=https://<project-ref>.supabase.co " +
        "so the API can fetch the JWKS it verifies access tokens against."
    );
  } else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|com)\/?$/.test(supabaseUrl.trim())) {
    errors.push(
      `SUPABASE_URL=${supabaseUrl} doesn't look like a Supabase project URL ` +
        "(expected https://<project-ref>.supabase.co)."
    );
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
      `db=${isSupabaseHost(process.env.DATABASE_URL) ? "supabase" : "postgres"}, auth=supabase-jwks, ` +
      `cors=${process.env.ALLOWED_ORIGINS ? "allowlist" : "dev-localhost"}`
  );
}
