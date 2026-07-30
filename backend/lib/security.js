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
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "./cache.js";

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
    // Helmet defaults COOP to "same-origin", which severs window.opener between
    // this page and the Firebase signInWithPopup window. The popup completes the
    // Google flow, closes, and can never post the credential back — the user sees
    // it vanish with no error anywhere, and sign-in silently fails.
    //
    // "same-origin-allow-popups" is the narrowest policy that fixes it: this page
    // keeps its opener reference to popups IT opened, while any cross-origin page
    // that opens US is still severed from this window. Cross-origin isolation is
    // already off (COEP is disabled above for the same OAuth reason), so this
    // gives up nothing we currently rely on.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
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
// Three layers, deliberately keyed differently. The ordering constraint
// is a security one and must not be "simplified" later:
//
//   IP layer      runs before auth, so it can only key on IP.
//   Account layer runs AFTER requireAuth(), so req.account is a VERIFIED
//                 identity. Keying on a token before verification would
//                 let an attacker put someone else's uid in an unsigned
//                 token to drain their bucket, or rotate uids to escape
//                 limiting entirely. Never move this above requireAuth().
//
// A school of 50 teachers shares one NAT gateway, so an IP-only limit is
// wrong in both directions at once: it throttles a whole staff room while
// letting one abusive account run free inside the shared budget. The IP
// layer is now only a flood wall; per-teacher fairness is the account
// layer's job.
//
// Store: Redis when REDIS_URL is configured, in-process otherwise. This is
// the difference between a limit and a suggestion once we run more than one
// instance — N instances with in-process counters mean an attacker gets N×
// the budget, and every deploy hands out a fresh one. Redis makes the counter
// shared and deploy-durable.
//
// passOnStoreError is deliberate and important. Without it a Redis blip turns
// every rate-limited route (i.e. all of /api) into a 500 — the limiter would
// become the outage. With it, a store failure is logged and the request is
// allowed through: we lose rate limiting for the duration rather than losing
// the API. Availability wins here because the limiters are abuse control, not
// an authorisation boundary — requireAuth() and requireRole() are unaffected
// by any of this and keep enforcing on every request.

// A Redis outage makes every limiter's store fail on every request, and the
// library's default logger prints a full stack trace each time — so an outage
// would bury the logs that explain it under thousands of copies of itself.
// Collapse it: one line when it starts, one when it recovers, and re-arm so a
// second outage is reported again.
let storeErrorLogged = false;
const limiterLogger = {
  error(err) {
    if (storeErrorLogged) return;
    storeErrorLogged = true;
    console.warn(
      `[ratelimit] store unavailable — requests are passing UNLIMITED until it ` +
      `recovers: ${err?.message || err}`
    );
  },
  warn(err) { console.warn(`[ratelimit] ${err?.message || err}`); },
};
export const noteRateLimitStoreRecovered = () => {
  if (storeErrorLogged) {
    storeErrorLogged = false;
    console.log("[ratelimit] store recovered");
  }
};

// Shared shape — every limiter reports RateLimit headers (RFC 9239 draft-7,
// the combined `RateLimit: limit=…, remaining=…, reset=…` form) so the client
// can back off instead of guessing.
const LIMITER_BASE = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  passOnStoreError: true,
  logger: limiterLogger,
};

// One store per limiter — they must not share a key space or the five buckets
// would decrement each other. `prefix` keeps them separate.
//
// Bound at build time to the client itself, not to its connection state: the
// socket is still opening when buildApp() runs, so a health check here would
// always say "not ready" and pin every limiter to memory for the life of the
// process. Commands that land before the socket is up fail, and
// passOnStoreError turns that into an allowed request rather than a 500.
function storeFor(prefix) {
  const client = redisClient();
  if (!client) return undefined; // no REDIS_URL — express-rate-limit's memory store
  return new RedisStore({
    prefix: `murchid:rl:${prefix}:`,
    sendCommand: (...args) => client.call(...args),
  });
}

// Verified-account key when we have one, IP otherwise. ipKeyGenerator is
// the library's helper — it normalises IPv6 to a /56 block so a single
// client can't walk its own address space to get unlimited buckets.
const byAccountOrIp = (req) =>
  req.account?.id ? `acct:${req.account.id}` : `ip:${ipKeyGenerator(req.ip)}`;

// Layer 1 — flood wall. Mounted on /api only (see app.js): in dev this
// same Express app also serves Vite's module graph, where one page load
// is 100+ requests, and counting those made the whole site 429 after
// roughly three page loads. Generous, because fairness is layer 2's job.
export function buildGlobalRateLimit() {
  return rateLimit({
    ...LIMITER_BASE,
    store: storeFor("global"),
    windowMs: 5 * 60 * 1000,
    limit: 1000,
    message: { error: "Too many requests. Please slow down." },
  });
}

// Layer 2 — per-teacher fairness. Mounted immediately after requireAuth()
// so the key is a verified account id. 300 / 5 min is far above real use
// (a page load is 3–8 calls) but stops one account hammering the API.
export function buildAccountRateLimit() {
  return rateLimit({
    ...LIMITER_BASE,
    store: storeFor("account"),
    windowMs: 5 * 60 * 1000,
    limit: 300,
    keyGenerator: byAccountOrIp,
    message: { error: "Too many requests. Please slow down." },
  });
}

// Layer 3 — AI generation. Every call here costs real money and holds a
// streaming connection open, so it gets its own much tighter bucket. This
// is burst protection only; durable per-plan spend caps come with the
// usage ledger.
export function buildAiRateLimit() {
  return rateLimit({
    ...LIMITER_BASE,
    store: storeFor("ai"),
    windowMs: 5 * 60 * 1000,
    limit: 30,
    keyGenerator: byAccountOrIp,
    message: {
      error: "You're generating very quickly. Give it a moment and try again.",
    },
  });
}

// Public surface. `/api/schools` is the only route reachable without a token
// (the catalog is read during onboarding, before a teacher row exists), so it
// is the one place layer 2's per-account fairness cannot help. Layer 1's
// ceiling is deliberately generous — that headroom exists for a NATed school's
// AUTHENTICATED traffic, and letting anonymous callers spend it would be the
// wrong trade. 120 per 5 min is far above real onboarding use (a teacher
// searches the catalog a handful of times, once) and far below useful abuse.
export function buildPublicRateLimit() {
  return rateLimit({
    ...LIMITER_BASE,
    store: storeFor("public"),
    windowMs: 5 * 60 * 1000,
    limit: 120,
    keyGenerator: byAccountOrIp,
    message: { error: "Too many requests. Please slow down." },
  });
}

// Auth bootstrap + renew. Necessarily pre-auth, so IP-keyed: this is the
// credential-stuffing brake and 10 attempts per 15 minutes is plenty for
// a real person. Dev gets a looser ceiling purely because signing in and
// out repeatedly is normal while building; production is never relaxed.
export function buildAuthRateLimit() {
  return rateLimit({
    ...LIMITER_BASE,
    store: storeFor("auth"),
    windowMs: 15 * 60 * 1000,
    limit: isProd() ? 10 : 200,
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
