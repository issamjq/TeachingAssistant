import express from "express";
import cors from "cors";
import meRouter from "./routes/me.js";
import templatesRouter from "./routes/templates.js";
import draftsRouter from "./routes/drafts.js";
import teachersRouter from "./routes/teachers.js";
import studentsRouter from "./routes/students.js";

// Build the Express app. Used by:
//   - server/index.js — standalone, listens on PORT (Render)
//   - vite.config.js  — mounted as Vite middleware in dev
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

  app.use(express.json({ limit: "1mb" }));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  app.use("/api/me", meRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/drafts", draftsRouter);
  app.use("/api/teachers", teachersRouter);
  app.use("/api/students", studentsRouter);

  return app;
}
