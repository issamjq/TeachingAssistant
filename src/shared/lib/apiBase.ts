"use client";

// =====================================================================
// Where /api calls go, and the development override for it
//
// Normally: nowhere. API_BASE is empty in every deployment, the browser
// calls its own origin, and next.config.ts rewrites /api/* to the
// backend server-side. That rewrite is why there is no CORS preflight in
// production, and it is also why it cannot help here — it is resolved by
// Vercel, and Vercel cannot reach a laptop.
//
// So testing a deployed frontend against a backend running on your own
// machine means the BROWSER has to call your machine directly, which
// means a base URL it can be told at runtime.
//
// That is a loaded gun in production. Every call made through here
// carries `Authorization: Bearer <supabase jwt>` and `X-Session-Id`, so
// anything that can set this value can harvest a signed-in teacher's
// session and choose what the app renders back. It is therefore gated on
// a BUILD FLAG, not on a gesture: NEXT_PUBLIC_ALLOW_API_OVERRIDE is set
// on preview deployments only.
//
// With it unset the flag inlines to `false` and every function here hard
// -returns before touching storage — so planting the key by hand in
// devtools on production changes nothing, which is the guarantee that
// matters. The editor is a lazy chunk that is never rendered and so
// never fetched; it is still COMPILED, because `dynamic(() => import())`
// is statically analysable and both bundlers emit the chunk whether or
// not the branch requesting it can run. Stripping it outright needs a
// bundler-specific module replacement, which Turbopack does not offer
// for relative specifiers. Unreachable, not absent — stated plainly here
// rather than assumed.
// =====================================================================

import { API_BASE, ALLOW_API_OVERRIDE } from "@/config/env";

const KEY = "murchid.dev.apiBase";

/** Fires when the override changes, so the banner and panel stay in step. */
const listeners = new Set<() => void>();

export function subscribeApiBase(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The override, or "" when there is none or overriding is not allowed. */
export function readApiOverride(): string {
  if (!ALLOW_API_OVERRIDE) return "";
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function readApiOverrideOnServer(): string {
  return "";
}

/**
 * What every request prefixes its path with.
 *
 * Read per call rather than captured at module load: the whole point is
 * that it can change without a reload.
 */
export function apiBase(): string {
  if (!ALLOW_API_OVERRIDE) return API_BASE;
  if (typeof window === "undefined") return API_BASE;
  return readApiOverride() || API_BASE;
}

export type ValidationResult =
  | { ok: true; value: string; local: boolean }
  | { ok: false; reason: string };

/**
 * Accept an origin, or say why not.
 *
 * Deliberately strict about SHAPE — an origin, no path, no query — so a
 * pasted full endpoint (".../api/studio/generate") fails loudly here
 * instead of producing /api/api/... at the first request.
 */
export function validateApiBase(raw: string): ValidationResult {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return { ok: false, reason: "Enter an origin, or clear the override." };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Not a URL. Include the scheme — http://localhost:3001" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `Unsupported scheme "${url.protocol}". Use http or https.` };
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return { ok: false, reason: "Origin only — drop the path. Requests append /api/… themselves." };
  }
  if (url.search || url.hash) {
    return { ok: false, reason: "Origin only — drop the query string." };
  }

  const host = url.hostname;
  const local =
    host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");

  return { ok: true, value: trimmed, local };
}

export function writeApiOverride(value: string) {
  if (!ALLOW_API_OVERRIDE) return;
  try {
    if (value) window.localStorage.setItem(KEY, value);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode — the override simply does not stick */
  }
  listeners.forEach((l) => l());
}
