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
//   - CSP allows Firebase Auth's iframe + popup redirect URL
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
          "https://*.firebaseapp.com",
          "https://images.pexels.com",
        ],
        connectSrc: [
          "'self'",
          "https://*.googleapis.com",
          "https://*.firebaseapp.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://www.googleapis.com",
          // Allow same-origin API calls during dev when the frontend
          // runs on a different port from the API
          ...(isProd() ? [] : ["http://localhost:*", "ws://localhost:*"]),
        ],
        // Firebase Auth signInWithPopup loads accounts.google.com /
        // login.microsoftonline.com inside an iframe — frame-src must
        // allow them or the popup falls back to a redirect we don't
        // expect.
        frameSrc: [
          "'self'",
          "https://*.firebaseapp.com",
          "https://accounts.google.com",
          "https://login.microsoftonline.com",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        // upgradeInsecureRequests only makes sense once the deploy is
        // fully on HTTPS; leave it off in dev.
        ...(isProd() ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    crossOriginEmbedderPolicy: false, // would block Firebase popups
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

  // Dev fallback: allow common localhost ports. Production refuses to
  // start without ALLOWED_ORIGINS (see env.js validateEnv()).
  if (!isProd() && list.length === 0) {
    for (const p of [5173, 5174, 5175, 5176, 5177, 5178]) {
      list.push(`http://localhost:${p}`);
    }
  }

  return cors({
    origin(origin, cb) {
      // Same-origin requests (curl, server-side health checks) have no
      // Origin header and are allowed. Browser requests from anywhere
      // not in the list are rejected.
      if (!origin) return cb(null, true);
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
export function buildAuthRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again later." },
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
