import "dotenv/config";
import { buildApp } from "./app.js";
import { runInit } from "./db/init.js";

// Boot sequence:
//   1. Apply schema + seeds (idempotent — safe to run every restart)
//   2. Start the HTTP server
//
// Running init on every boot means schema changes ship with code
// changes: push to GitHub → Render deploys → init runs → server starts.
// Set SKIP_DB_INIT=1 as an emergency escape hatch (e.g. if a future
// migration accidentally lands in a bad state and you need to get the
// server back online before fixing the script).
async function boot() {
  if (process.env.SKIP_DB_INIT === "1") {
    console.log("[murchid-api] SKIP_DB_INIT=1 — skipping schema init");
  } else {
    try {
      console.log("[murchid-api] running schema init …");
      await runInit();
    } catch (err) {
      console.error("[murchid-api] schema init failed:", err);
      console.error("[murchid-api] starting server anyway — set SKIP_DB_INIT=1 to silence");
    }
  }

  const app = buildApp();
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, () => {
    console.log(`[murchid-api] listening on :${port}`);
  });
}

boot().catch((err) => {
  console.error("[murchid-api] boot failed:", err);
  process.exit(1);
});
