// =====================================================================
// npm run db:seed — reference data the app needs to be usable
//
// What replaced db/init.js, and deliberately much smaller than it.
//
// init.js built the entire pre-Supabase schema and then seeded it with
// dummy teachers, dummy students, sample drafts and a demo timetable.
// The schema is authored in Supabase now, and the demo rows were only
// ever there so a fresh checkout had something on screen — on a live
// project they are litter.
//
// So this seeds exactly two things, both of which are REFERENCE data
// rather than examples:
//
//   schools        the UAE catalog the onboarding picker chooses from,
//                  read from src/lib/schools.js so the list has one
//                  home and the frontend and the table cannot disagree
//   feature_flags  the gates the dev console toggles
//
// Idempotent. Re-running never duplicates a row and never overwrites a
// flag someone has switched on.
// =====================================================================
import "dotenv/config";
import { pool } from "./client.js";
import { UAE_SCHOOLS } from "../src/lib/schools.js";

const FLAGS = [
  ["ai_studio", "AI Studio generation endpoints"],
  ["quizzes", "Quiz authoring and assignment"],
  ["chatbot", "The assistant, on the landing page and in the studio"],
];

async function run() {
  try {
    // One statement rather than a loop of 45. unnest turns the arrays
    // into rows, so this is a single round trip to a database that is
    // not on this machine.
    const cols = ["name", "name_ar", "emirate", "city", "type", "curriculum"];
    const values = cols.map((c) => UAE_SCHOOLS.map((s) => s[c] ?? null));
    const ins = await pool.query(
      `INSERT INTO schools (name, name_ar, emirate, city, type, curriculum)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[])
       ON CONFLICT DO NOTHING`,
      values
    );
    console.log(`  schools: ${ins.rowCount} added (${UAE_SCHOOLS.length} in the catalog)`);

    for (const [key, description] of FLAGS) {
      await pool.query(
        `INSERT INTO feature_flags (key, enabled, description)
         VALUES ($1, false, $2)
         ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description`,
        [key, description]
      );
    }
    console.log(`  feature flags: ${FLAGS.length} present`);
    console.log("\n✅ Seeded.");
  } catch (e) {
    console.error("\n❌ Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
