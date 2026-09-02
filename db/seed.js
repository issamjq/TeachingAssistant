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
import { CURRICULA, CURRICULUM_UNITS } from "../src/lib/curriculum.js";

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

    // The curriculum catalog. Same unnest idiom as the schools above:
    // one round trip, not a loop per row.
    const cur = CURRICULA;
    await pool.query(
      `INSERT INTO curricula (code, name, name_ar, region)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name, name_ar = EXCLUDED.name_ar, region = EXCLUDED.region`,
      [cur.map((c) => c.code), cur.map((c) => c.name),
       cur.map((c) => c.name_ar ?? null), cur.map((c) => c.region ?? null)],
    );
    console.log(`  curricula: ${cur.length} present`);

    // Units are authoritative from this file: a corrected title or a
    // reworded outcome should REPLACE what is in the table, or the
    // catalog and the database drift and nobody can tell which is right.
    //
    // One jsonb payload rather than parallel arrays: `outcomes` is a
    // text[] per row, and unnest flattens a 2-D array into one long
    // list, so the arrays-of-arrays shape cannot survive that idiom.
    const u = CURRICULUM_UNITS;
    await pool.query(
      `INSERT INTO curriculum_units
         (curriculum_code, grade, subject, seq, title, outcomes, typical_weeks, source)
       SELECT curriculum_code, grade, subject, seq, title, outcomes, typical_weeks, source
         FROM jsonb_to_recordset($1::jsonb) AS x(
           curriculum_code text, grade text, subject text, seq int,
           title text, outcomes text[], typical_weeks int, source text)
       ON CONFLICT (curriculum_code, grade, subject, seq) DO UPDATE
         SET title = EXCLUDED.title, outcomes = EXCLUDED.outcomes,
             typical_weeks = EXCLUDED.typical_weeks, source = EXCLUDED.source,
             updated_at = now()`,
      [JSON.stringify(u)],
    );
    const cells = new Set(u.map((x) => `${x.curriculum_code}/${x.grade}/${x.subject}`));
    console.log(`  curriculum units: ${u.length} across ${cells.size} class(es)`);
    console.log("\n✅ Seeded.");
  } catch (e) {
    console.error("\n❌ Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
