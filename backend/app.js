import express from "express";
import compression from "compression";
import meRouter from "./routes/me.js";
import templatesRouter from "./routes/templates.js";
import draftsRouter from "./routes/drafts.js";
import teachersRouter from "./routes/teachers.js";
import studentsRouter from "./routes/students.js";
import scheduleRouter from "./routes/schedule.js";
import quizzesRouter from "./routes/quizzes.js";
import homeworkRouter from "./routes/homework.js";
import attendanceRouter from "./routes/attendance.js";
import gradesRouter from "./routes/grades.js";
import quizScoresRouter from "./routes/quiz-scores.js";
import presentationsRouter from "./routes/presentations.js";
import activitiesRouter from "./routes/activities.js";
import notificationsRouter from "./routes/notifications.js";
import libraryRouter from "./routes/library.js";
import dashboardRouter from "./routes/dashboard.js";
import studioRouter from "./routes/studio.js";
import imagesRouter from "./routes/images.js";
import schoolsRouter from "./routes/schools.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import superadminRouter from "./routes/superadmin.js";
import ownerRouter from "./routes/owner.js";
import moeRouter from "./routes/moe.js";
import devRouter from "./routes/dev.js";
import { requireAuth, requireRole } from "./lib/auth.js";
import { pool } from "./lib/db.js";
import { verifyKeysetSpecs } from "./lib/pagination.js";
import {
  buildHelmet, buildCors,
  buildGlobalRateLimit, buildAuthRateLimit, buildAccountRateLimit, buildAiRateLimit,
  buildPublicRateLimit,
  buildTimeout,
} from "./lib/security.js";

// Build the Express app. Used by:
//   - backend/index.js — standalone, listens on PORT (Render)
//   - vite.config.js   — mounted as Vite middleware in dev
//
// Security middleware stack, in the order they fire:
//   1. helmet           — sets headers + CSP on every response
//   2. CORS             — allowlist; refuses unknown origins
//   3. compression      — gzips JSON responses (cuts BW + SQL info leak via length)
//   4. timeout          — kills handlers that hang past 25s
//   5. json body parser — capped at 2MB by default (upload routes opt in to higher)
//   6. global rate-limit — 300 req / 5 min / IP
//   7. healthz endpoint — sits OUTSIDE auth so probes work without a token
//   8. routes…           — each protected by its own gate
//
// The auth gate is layered:
//   - /api/auth/*      — optional auth (the bootstrap endpoint itself)
//                        + tighter rate-limit (10 attempts / 15 min)
//   - /api/schools     — optional auth (the catalog is reachable during
//                        onboarding before the teacher row exists)
//   - everything else  — requireAuth() = valid Firebase token + existing
//                        teacher row + non-expired subscription
//   - /api/admin/*     — requireAuth() + requireRole("admin")
//   - /api/dev/*       — requireAuth() + requireRole("dev")
export function buildApp() {
  const app = express();

  // 0. Ask Postgres which list-sort columns are NOT NULL, which is what lets
  // keyset pagination use the fast (index-condition) cursor predicate instead
  // of the correct-but-unsargable one. Deliberately not awaited: it is a
  // pure optimisation, requests that land first simply take the safe path,
  // and a failure here must never stop the app from serving. See
  // verifyKeysetSpecs() for why the answer has to come from the schema.
  verifyKeysetSpecs(pool)
    .then(({ verified, total }) =>
      console.log(`[pagination] keyset fast path: ${verified}/${total} list specs`)
    )
    .catch((err) =>
      console.warn(`[pagination] keyset verification failed, staying on the safe path: ${err.message}`)
    );

  // 1. Trust the proxy header from Render/Vercel so req.ip is the real
  // client IP, not the load balancer. Without this, rate limits would
  // collapse all traffic to a single IP and audit logs would be useless.
  // We accept only 1 hop (the platform proxy) — not arbitrary depth,
  // which would let attackers spoof X-Forwarded-For.
  app.set("trust proxy", 1);

  // 2. Security headers BEFORE everything else so even error responses
  // carry CSP / HSTS / Referrer-Policy.
  app.use(buildHelmet());

  // 3. CORS — explicit allowlist (see ALLOWED_ORIGINS in .env).
  app.use(buildCors());

  // 4. Gzip JSON responses.
  app.use(compression());

  // 5. Per-request timeout — close the socket if a handler hangs.
  app.use(buildTimeout(25_000));

  // 6. Body parser. Tight default (2mb) — image-upload route opts up
  // separately at the route level. Slide payloads, even multi-slide
  // ones, fit comfortably in 2mb of JSON.
  app.use(express.json({ limit: "2mb" }));

  // 7. Rate limit layer 1 of 3 — the flood wall. Mounted on /api rather
  // than globally: in dev this same app serves Vite's module graph, so a
  // global limiter counted 100+ asset requests per page load and 429'd
  // the entire site (including the HTML) after about three navigations.
  // /healthz sits outside /api and is therefore never counted, so load
  // balancers can probe freely. Layers 2 and 3 are at steps 11a and 12.
  app.use("/api", buildGlobalRateLimit());

  // 8. Open endpoints.
  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // 9. Auth bootstrap. Mounted with its own (tighter) rate limiter
  // BEFORE the global requireAuth — the route handles optional auth
  // internally because on first sign-in the teacher row doesn't exist
  // yet. The aggressive limit (10 req / 15 min) is the credential
  // stuffing brake.
  app.use("/api/auth", buildAuthRateLimit(), authRouter);

  // 10. Schools — catalog GET is reachable during onboarding before
  // the teacher row exists. The /mine endpoints inside still bail with
  // 404 when there's no teacher.
  // buildPublicRateLimit() sits ahead of the optional auth: this is the only
  // route anonymous callers can reach, so it gets its own tight bucket rather
  // than spending layer 1's ceiling (which exists for authenticated traffic).
  app.use(
    "/api/schools",
    buildPublicRateLimit(),
    requireAuth({ optional: true }),
    schoolsRouter
  );

  // 11. From here down: requireAuth() = full enforcement (valid token
  // + teacher row + non-expired subscription).
  app.use("/api", requireAuth());

  // 11a. Rate limit layer 2 — per-teacher fairness. Deliberately AFTER
  // requireAuth() so it keys on a VERIFIED account id. Placing it any
  // earlier would mean keying on an unverified token, letting an attacker
  // borrow another teacher's uid to exhaust their quota, or rotate uids
  // to slip the limit entirely. This is the layer that makes a school
  // behind one NAT gateway work: 50 teachers now hold 50 buckets, not one.
  app.use("/api", buildAccountRateLimit());

  // 12. Teacher-owned data.
  app.use("/api/me", meRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/drafts", draftsRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/schedule", scheduleRouter);
  app.use("/api/quizzes", quizzesRouter);
  app.use("/api/homework", homeworkRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/grades", gradesRouter);
  app.use("/api/quiz-scores", quizScoresRouter);
  app.use("/api/presentations", presentationsRouter);
  app.use("/api/activities", activitiesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/library", libraryRouter);
  app.use("/api/dashboard", dashboardRouter);
  // Rate limit layer 3 — AI generation gets its own much tighter bucket
  // on top of layer 2. Every call bills real tokens and pins a streaming
  // connection open, so a runaway client here is expensive in a way that
  // fetching /api/dashboard is not.
  app.use("/api/studio", buildAiRateLimit(), studioRouter);
  app.use("/api/images", imagesRouter);

  // 13. Cross-tenant — admin manages teacher accounts, dev inspects
  // everything. The role check is on top of requireAuth(), so even a
  // valid teacher token gets 403 if they're not in the right role.
  // The pyramid: dev > super_admin > admin > teacher. dev + super_admin
  // can hit everything admin can; super_admin additionally creates
  // admin/moe/owner accounts (handler-level canGrantRole() enforces).
  // moe + owner routers come later when their dashboards land.
  app.use("/api/teachers",   requireRole("admin", "super_admin", "dev"),    teachersRouter);
  app.use("/api/admin",      requireRole("admin", "super_admin", "dev"),    adminRouter);
  app.use("/api/superadmin", requireRole("super_admin", "dev"),             superadminRouter);
  app.use("/api/owner",      requireRole("owner", "super_admin", "dev"),    ownerRouter);
  app.use("/api/moe",        requireRole("moe", "super_admin", "dev"),      moeRouter);
  app.use("/api/dev",        requireRole("dev"),                            devRouter);

  // 14. JSON 404 (any /api/* that didn't match falls through here).
  // We expose a generic message so an attacker probing for endpoints
  // can't enumerate them.
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // 15. Last-resort error handler. Catches anything a route forgot to
  // try/catch (a thrown Express middleware error, a buggy timeout, a
  // body-parser SyntaxError on bad JSON). Sanitises before sending.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const id = Math.random().toString(36).slice(2, 10);
    console.error(`[unhandled] [errId=${id}]`, err);
    if (res.headersSent) return;
    // Common body-parser failures: JSON syntax error or oversized body.
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON body.", errorId: id });
    }
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body too large.", errorId: id });
    }
    // CORS rejection from buildCors() — give the client a clear 403.
    if (err.message && err.message.startsWith("CORS:")) {
      return res.status(403).json({ error: "Origin not allowed." });
    }
    res.status(500).json({ error: "Something went wrong.", errorId: id });
  });

  return app;
}
