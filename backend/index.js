import "dotenv/config";
import { buildApp } from "./app.js";
import { validateEnv } from "./lib/env.js";

// Boot: check the environment, then serve.
//
// This used to build the entire database schema on every start. That
// made sense when the schema lived in db/init.js and shipped with the
// code — push, deploy, migrate, serve. It does not now: the schema is
// authored in Supabase, and running a schema builder against it on every
// restart is a large, slow, and occasionally destructive thing to do
// before answering a single request.
//
// Schema changes are applied deliberately, by hand, from a machine that
// can read the output:
//
//   npm run db:tune   backend/db/tune.sql — structure, indexes, policies
//   npm run db:seed   reference data (the schools catalog, feature flags)
//
// Both are idempotent. Neither runs here.
async function boot() {
  // Fail fast on a misconfigured environment — better to crash at boot
  // than to serve traffic with missing secrets or wildcard CORS in prod.
  validateEnv();

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
