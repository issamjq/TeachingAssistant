// The single place client-side environment configuration is read.
//
// Vite exposed browser env as `import.meta.env.VITE_*`. Next exposes it as
// `process.env.NEXT_PUBLIC_*`, inlined at build time. The references below
// must stay written out literally — the bundler does a static text
// substitution, so `process.env[someVariable]` silently yields undefined.
//
// Previously these reads were scattered across firebase.js and three view
// files. Centralising them means a missing variable surfaces here, once,
// instead of as a cryptic runtime error deep in a feature.

function required(name: string, value: string | undefined): string {
  if (!value && typeof window !== "undefined") {
    // Warn rather than throw: a missing Firebase key should degrade to a
    // failed sign-in, not a blank page for every route.
    console.warn(
      `[config] Missing ${name}. Set it in .env.local (dev) or the Vercel project (prod).`
    );
  }
  return value ?? "";
}

// ── Supabase ──────────────────────────────────────────────────────────
//
// Both values are public by design. The publishable key identifies the
// project and nothing more — it carries no privileges of its own, and
// access is decided by Row Level Security plus the backend's own token
// verification. (The SECRET key is the privileged one; it must never
// appear here, or anywhere else behind a NEXT_PUBLIC_ prefix, because
// that prefix inlines the value into the browser bundle.)
export const supabaseUrl = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

export const supabasePublishableKey = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

// True when Supabase has enough configuration to attempt initialisation.
// Lets callers degrade gracefully instead of throwing at module scope.
export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);

// Prefix for /api calls.
//
// Empty in every normal deployment: next.config.ts rewrites /api/* to the
// Express server, so the browser always talks to its own origin. That
// removes the CORS preflight the old VITE_API_URL cross-origin setup
// needed. Override only when pointing a local frontend at a remote API.
export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(
  /\/$/,
  ""
);

// ── development: point the browser at another backend ─────────────────
//
// Set to "1" on PREVIEW deployments only. It unlocks a panel that
// rewrites the /api prefix at runtime so a deployed frontend can call a
// backend running on your own machine — see src/shared/lib/apiBase.ts
// for why that has to be a browser-side base URL rather than the
// server-side rewrite, and why it must never ship to production.
//
// Compared against a literal so the bundler can fold it: with the
// variable unset this is `false` at build time and every branch guarded
// by it, including the import of the editor, is eliminated.
export const ALLOW_API_OVERRIDE =
  process.env.NEXT_PUBLIC_ALLOW_API_OVERRIDE === "1";
