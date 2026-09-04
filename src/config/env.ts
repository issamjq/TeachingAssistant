// The single place client-side environment configuration is read.
// process.env.NEXT_PUBLIC_* is inlined at build time — references must
// stay written out literally (no dynamic property access) or the
// bundler's static substitution silently yields undefined.

function required(name: string, value: string | undefined): string {
  if (!value && typeof window !== "undefined") {
    // Warn rather than throw: a missing key should degrade to "sign-in
    // unavailable", not a blank page for every route.
    console.warn(
      `[config] Missing ${name}. Set it in .env.local (dev) or the Vercel project (prod).`,
    );
  }
  return value ?? "";
}

// Both values are public by design — the publishable key identifies the
// project and carries no privileges of its own; access is decided by Row
// Level Security. The secret/service key must never appear here or
// anywhere behind a NEXT_PUBLIC_ prefix, since that prefix inlines the
// value into the browser bundle.
export const supabaseUrl = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const supabasePublishableKey = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);
