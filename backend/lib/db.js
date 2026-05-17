import "dotenv/config";
import pg from "pg";

// Keep DATE columns (OID 1082) as the raw "YYYY-MM-DD" string instead of
// letting node-postgres turn them into a JS Date at LOCAL midnight. That
// Date, once JSON-serialized by Express (toISOString → UTC), rolled the
// day back by one in UTC+ timezones (UAE = +4): a quiz set to May 17
// came back as "2026-05-16T20:00:00Z" and showed everywhere as May 16.
// A plain date string has no timezone, so it round-trips exactly.
pg.types.setTypeParser(1082, (v) => v);

// Single pg.Pool shared by every route handler. Render's web service is a
// long-running process so a pool with the default size is the right shape;
// in dev (Vite middleware) the same module instance gives us the same pool.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
