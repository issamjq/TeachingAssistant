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
