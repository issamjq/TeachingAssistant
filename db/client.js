import "dotenv/config";
import pg from "pg";
import { SUPABASE_CA, isSupabaseHost } from "./supabaseCa.js";

// Keep DATE columns (OID 1082) as the raw "YYYY-MM-DD" string instead of
// letting node-postgres turn them into a JS Date at LOCAL midnight. That
// Date, once JSON-serialized by Express (toISOString → UTC), rolled the
// day back by one in UTC+ timezones (UAE = +4): a quiz set to May 17
// came back as "2026-05-16T20:00:00Z" and showed everywhere as May 16.
// A plain date string has no timezone, so it round-trips exactly.
pg.types.setTypeParser(1082, (v) => v);

// TLS. Supabase's Postgres endpoints accept unencrypted connections, so
// omitting `ssl` here does not fail — it silently sends every query in
// plaintext. We pin the Supabase root CA instead, which gets us a fully
// verified TLS 1.3 session (chain + hostname) on both the pooler and the
// direct host. See lib/supabaseCa.js for why the obvious alternatives
// (sslmode=require, rejectUnauthorized:false) don't work here.
//
// Only applied to Supabase hosts. Other providers (Neon) carry their own
// sslmode in the connection string and are signed by public CAs already
// in the system trust store — handing them the Supabase root would break
// verification, so we leave their behaviour untouched.
const connectionString = process.env.DATABASE_URL;
const ssl = isSupabaseHost(connectionString)
  ? { ca: SUPABASE_CA, rejectUnauthorized: true }
  : undefined;

// Single pg.Pool shared by every route handler. Render's web service is a
// long-running process so a pool with the default size is the right shape;
// in dev the same module instance gives us the same pool.
export const pool = new pg.Pool({ connectionString, ssl });

// ── Say which database this is, before anything runs against it ───────
//
// tune.sql does not build a schema; it ADJUSTS the one authored in the
// Supabase console. Pointed anywhere else it fails on its first statement
// with `relation "public.users" does not exist` at some character offset,
// which reads like a broken migration rather than the truth: the
// connection string is for a different database.
//
// The specific way to get here is a leftover: this project ran on Neon
// before Supabase, and that string is still in older .env files. So name
// the host rather than letting the SQL discover it.
if (!connectionString) {
  console.error(
    "\n❌ DATABASE_URL is not set.\n" +
    "   These scripts read .env (not .env.local). See .env.example — you want\n" +
    "   the Supabase transaction pooler string, port 6543.\n"
  );
  process.exit(1);
}
if (!isSupabaseHost(connectionString)) {
  const host = (connectionString.match(/@([^/?:]+)/) || [])[1] || "unknown host";
  console.warn(
    `\n⚠️  DATABASE_URL points at ${host}, which is not a Supabase host.\n` +
    "   The schema these scripts adjust lives in Supabase — against anything\n" +
    "   else the first statement fails with 'relation public.users does not\n" +
    "   exist'. If this is the old Neon database, replace the string:\n" +
    "   Supabase dashboard → Connect → Transaction pooler (port 6543).\n"
  );
}
