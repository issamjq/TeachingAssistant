import "dotenv/config";
import pg from "pg";

// Single pg.Pool shared by every route handler. Render's web service is a
// long-running process so a pool with the default size is the right shape;
// in dev (Vite middleware) the same module instance gives us the same pool.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
