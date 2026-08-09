// =====================================================================
// npm run db:tune — apply backend/db/tune.sql to the live database
//
// Separate from db:init because they now mean opposite things. init
// builds the pre-Supabase schema from scratch; tune adjusts the schema
// that was authored in Supabase directly. See the guard at the top of
// init.js for why the two must not be run against the same database.
//
// The whole file runs in ONE transaction: it either all applies or none
// of it does, so a failure halfway through cannot leave the database
// holding half a migration.
// =====================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";
import { pool } from "../lib/db.js";

const here = dirname(fileURLToPath(import.meta.url));

async function run() {
  const sql = readFileSync(join(here, "tune.sql"), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // NOTICEs are how the DO blocks report what they skipped.
    client.on("notice", (n) => console.log("  ·", n.message));
    await client.query(sql);
    await client.query("COMMIT");
    console.log("\n✅ tune.sql applied.");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\n❌ Rolled back — nothing was changed.");
    console.error(`   ${e.message}`);
    if (e.position) console.error(`   at character ${e.position}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
