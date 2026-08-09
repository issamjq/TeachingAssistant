// Centralised security middleware. The app.js builder wires these in;
// each function here owns one concern so the policy is easy to read.
//
//   buildHelmet()     — security headers + Content Security Policy
//   buildCors()       — origin allowlist, no wildcards in prod
//   buildRateLimit()  — per-IP rate limit (global + auth-specific)
//   buildTimeout()    — request timeout so a stuck handler can't pin
//                       the worker forever
//
// Tradeoffs explicitly chosen:
//   - CSP allows Google Fonts (project requirement: Fraunces, Inter Tight,
//     JetBrains Mono, Amiri are loaded from fonts.googleapis.com)
//   - CSP allows Supabase Auth (GoTrue) XHR + the OAuth redirect
//   - 'unsafe-inline' for style-src is needed by React inline styles +
//     Tailwind; we keep script-src strict and rely on framework-level
//     XSS defences (React auto-escapes, runsToHtml uses escapeHtml)
//   - rate limits skip /healthz so loadbalancers can probe freely

import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

const isProd = () => process.env.NODE_ENV === "production";

// ── Helmet (security headers + CSP) ────────────────────────────────────
export function buildHelmet() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Vite injects a small inline bootstrap; keep this only for dev.
          // Production builds are fully external script files.
          ...(isProd() ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
          "https://apis.google.com",
          "https://www.gstatic.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // React inline style props + Tailwind utilities
          "https://fonts.googleapis.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://*.googleusercontent.com",  // Google profile photos
          "https://*.supabase.co",            // Supabase Storage avatars
          "https://images.pexels.com",
        ],
        connectSrc: [
          "'self'",
          // Supabase Auth (GoTrue) is called directly from the browser:
          // token exchange, refresh, sign-out, and the JWKS fetch all go
          // to https://<ref>.supabase.co. Without this, sign-in fails at
          // the network layer with an opaque CSP violation.
          "https://*.supabase.co",
          "wss://*.supabase.co",              // realtime, if it lands later
          // Allow same-origin API calls during dev when the frontend
          // runs on a different port from the API
          ...(isProd() ? [] : ["http://localhost:*", "ws://localhost:*"]),
        ],
        // Supabase OAuth is a full top-level redirect, not a popup in an
        // iframe the way Firebase's signInWithPopup was — so the provider
        // domains no longer need to be frame-src'd. Kept to 'self'.
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        // upgradeInsecureRequests only makes sense once the deploy is
        // fully on HTTPS; leave it off in dev.
        ...(isProd() ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false, // would block cross-origin auth assets
    // HSTS: enforce HTTPS for the apex + subdomains, 1 year. Only set
    // in production — devs run http://localhost.
    strictTransportSecurity: isProd()
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
}

// ── CORS (explicit origin allowlist) ───────────────────────────────────
export function buildCors() {
  const list = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

  // In development the allowlist is not enforced at all.
  //
  // Enumerating origins does not work behind a dev proxy: Next rewrites
  // /api/* to this server and forwards `Origin: null`, which matches
  // nothing however many localhost ports are listed — so every browser
  // call came back 403 "Origin not allowed" and sign-in died on
  // claim-session. Listing ports 5173-5178 (Vite's, pre-migration) hid
  // this for a while; listing 3000-3010 did not fix it, because the
  // problem was never which port.
  //
  // There is also nothing to defend here. The allowlist stops a hostile
  // SITE from making a browser call this API with someone's credentials;
  // on a developer's own machine, behind their own proxy, that threat
  // does not exist. Production is untouched: env.js refuses to start
  // without ALLOWED_ORIGINS, so this branch can never be reached there.
  const devAllowAll = !isProd() && list.length === 0;

  return cors({
    origin(origin, cb) {
      // Same-origin requests (curl, server-side health checks) have no
      // Origin header and are allowed. Browser requests from anywhere
      // not in the list are rejected.
      if (!origin) return cb(null, true);
      if (devAllowAll) return cb(null, true);
      if (list.includes(origin.replace(/\/$/, ""))) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: false, // Bearer tokens, not cookies — no need
    maxAge: 86400, // browser preflight cache
  });
}

// ── Rate limiting ──────────────────────────────────────────────────────
// Global: 300 req / 5 min per IP. Tuned for a normal teacher's session
// (lots of small /api/dashboard, /api/schedule polls). A single page
// load typically fires 3-8 calls; 300 in 5 min leaves headroom for
// active studio use without unblocking brute-force attempts.
export function buildGlobalRateLimit() {
  return rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7", // RateLimit-* headers per RFC 9239 draft
    legacyHeaders: false,
    skip: (req) => req.path === "/healthz",
    message: { error: "Too many requests. Please slow down." },
  });
}

// Tight limit on the auth bootstrap + renew endpoints. 10 per 15 min
// is plenty for a real user, brick-wall for credential-stuffing.
// The brake is meant to stop credential stuffing, so it counts only the
// endpoints where a guess can be made. It used to cover the whole
// /api/auth surface at 10 per 15 minutes, but ONE successful sign-in
// spends several of those on calls that verify an already-valid token —
// claim-session, me, supabase — so three or four honest attempts
// exhausted the budget and the fourth got a 429. Which the client then
// read as "no account" and answered with the onboarding form.
//
// Guessable endpoints stay at 10; the rest are left to the global
// limiter (300 / 5 min), which is plenty for a token that has already
// been verified cryptographically.
const GUESSABLE = new Set([
  "/email-verify/check",
  "/email-verify/send",
]);

export function buildAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again later." },
    // req.path here is relative to the mount point (/api/auth).
    skip: (req) => !GUESSABLE.has(req.path),
  });
}

// The assistant is reachable without an account and every message costs
// a model call, so it gets its own brake — looser than the sign-in one,
// because a real conversation is many messages, and far tighter than the
// global limit, because a script pointed at it spends our money.
//
// Keyed by IP like the others. That is imperfect behind a school's
// shared NAT, but 40 messages in 5 minutes is a lot of conversation even
// for a staffroom, and the alternative — no brake on an unauthenticated
// paid endpoint — is worse.
export function buildChatRateLimit() {
  return rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "You're sending messages faster than I can answer. Give it a moment." },
  });
}

// ── Request timeout ────────────────────────────────────────────────────
// Express has no built-in handler-level timeout. This sets a hard wall
// — if a handler hasn't responded in N ms, we close the socket so the
// worker doesn't get pinned by a slow query (or, worse, an exhaustion
// attack that opens many slow connections).
export function buildTimeout(ms = 25_000) {
  return (req, res, next) => {
    const t = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ error: "Request timed out." });
      }
      try { req.destroy(); } catch { /* ignore */ }
    }, ms);
    res.on("finish", () => clearTimeout(t));
    res.on("close",  () => clearTimeout(t));
    next();
  };
}
