import express from "express";
import cors from "cors";
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
import presentationsRouter from "./routes/presentations.js";
import activitiesRouter from "./routes/activities.js";
import notificationsRouter from "./routes/notifications.js";
import libraryRouter from "./routes/library.js";
import dashboardRouter from "./routes/dashboard.js";
import studioRouter from "./routes/studio.js";
import adminRouter from "./routes/admin.js";
import devRouter from "./routes/dev.js";

// Build the Express app. Used by:
//   - backend/index.js — standalone, listens on PORT (Render)
//   - vite.config.js   — mounted as Vite middleware in dev
//
// CORS is open by default. In production, set ALLOWED_ORIGINS to a
// comma-separated list of frontend URLs to lock it down.
export function buildApp() {
  const app = express();

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: allowedOrigins.length === 0 ? true : allowedOrigins,
      credentials: false,
    })
  );

  // 10mb fits ~7mb of base64-encoded payload (the inflation factor is
  // ~1.33×), enough for a quiz prompt + a single image or short PDF
  // attachment. Larger uploads are rejected at the route level.
  app.use(express.json({ limit: "10mb" }));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // Teacher data — every route is scoped by the current teacher's id.
  app.use("/api/me", meRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/drafts", draftsRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/schedule", scheduleRouter);
  app.use("/api/quizzes", quizzesRouter);
  app.use("/api/homework", homeworkRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/grades", gradesRouter);
  app.use("/api/presentations", presentationsRouter);
  app.use("/api/activities", activitiesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/library", libraryRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/studio", studioRouter);

  // Cross-tenant — admin manages teacher accounts, dev inspects everything.
  app.use("/api/teachers", teachersRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/dev", devRouter);

  return app;
}
