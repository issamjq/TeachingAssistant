// =====================================================================
// npm run db:superadmin — create or promote the platform super admin
//
// The super admin is the top of the pyramid (role.ts): full cross-tenant
// reach through the SECURITY DEFINER RPCs in tune.sql §30, its own portal
// at /superadmin, and every console + dashboard. This script is the one
// privileged step the browser cannot take itself — writing a role and, if
// asked, minting an auth login — so it runs from a machine that holds
// DATABASE_URL, exactly like db:tune and db:seed.
//
// Two modes, chosen automatically from whether the email already has an
// account:
//
//   PROMOTE  the email already signed in (e.g. with Google) → flip its
//            role to super_admin. No password needed.
//
//   CREATE   the email is new AND a password was given → mint an
//            email+password auth user (the seed-demo pattern: no
//            service-role key required), then make it super_admin. It can
//            then sign in at /superadmin with those credentials, or via
//            Google if the same address is a Google account.
//
// Usage:
//   node db/superadmin.js you@example.com
//   node db/superadmin.js you@example.com --password 'S3cret!'
//   SUPERADMIN_EMAIL=you@example.com SUPERADMIN_PASSWORD=... npm run db:superadmin
//
//   --demote   set the role back to 'teacher' instead (undo)
//
// Idempotent: re-running only re-asserts the role (and resets the
// password if one is supplied). It never touches any other account.
// =====================================================================
import "dotenv/config";
import { pool } from "./client.js";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const positional = argv.filter((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--password");

const EMAIL = (positional[0] || process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
const PASSWORD = opt("password") || process.env.SUPERADMIN_PASSWORD || "";
const DEMOTE = flag("demote");
const ROLE = DEMOTE ? "teacher" : "super_admin";

if (!EMAIL) {
  console.error(
    "\nGive an email.\n" +
    "  node db/superadmin.js you@example.com            # promote an existing account\n" +
    "  node db/superadmin.js you@example.com --password 'S3cret!'   # create + promote\n",
  );
  process.exit(1);
}

async function run() {
  const client = await pool.connect();
  const q = (sql, params) => client.query(sql, params);
  const one = async (sql, params) => (await q(sql, params)).rows[0] || null;

  try {
    await q("BEGIN");

    let user = await one("SELECT id FROM auth.users WHERE lower(email) = $1", [EMAIL]);
    let created = false;

    if (!user) {
      if (DEMOTE) throw new Error(`No account for ${EMAIL} — nothing to demote.`);
      if (!PASSWORD) {
        throw new Error(
          `No account for ${EMAIL} yet.\n` +
          `   Either sign in once at /superadmin with that email first, then re-run to promote,\n` +
          `   or pass --password to mint an email+password login now.`,
        );
      }

      // Mint the auth user the same way db/seed-demo does — straight into
      // auth.users, matching exactly what GoTrue writes (including the
      // identities row, without which a password sign-in is rejected).
      // No service-role key is needed for this path.
      const row = await one(
        `INSERT INTO auth.users (
           instance_id, id, aud, role, email, encrypted_password,
           email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
           created_at, updated_at,
           confirmation_token, recovery_token, email_change, email_change_token_new)
         VALUES (
           '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
           'authenticated', 'authenticated', $1::text, crypt($2::text, gen_salt('bf')),
           now(),
           '{"provider":"email","providers":["email"]}'::jsonb,
           jsonb_build_object('email', $1::text, 'email_verified', true, 'phone_verified', false),
           now(), now(),
           '', '', '', '')
         RETURNING id`,
        [EMAIL, PASSWORD],
      );
      user = row;
      created = true;

      await q(
        `INSERT INTO auth.identities
           (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
         VALUES ($1::text, $1::uuid,
           jsonb_build_object('sub', $1::text, 'email', $2::text, 'email_verified', true, 'phone_verified', false),
           'email', NULL, now(), now())`,
        [user.id, EMAIL],
      );
      await q(
        `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('sub', $1::text)
          WHERE id = $1`,
        [user.id],
      );
    } else if (PASSWORD && !DEMOTE) {
      // Existing account, password supplied → reset it so the operator can
      // sign in with known credentials.
      await q(
        `UPDATE auth.users SET
           encrypted_password = crypt($2::text, gen_salt('bf')),
           confirmation_token = COALESCE(confirmation_token, ''),
           recovery_token = COALESCE(recovery_token, ''),
           email_change = COALESCE(email_change, ''),
           email_change_token_new = COALESCE(email_change_token_new, '')
         WHERE id = $1`,
        [user.id, PASSWORD],
      );
    }

    // Mirror row. The handle_new_user trigger normally creates it, but it
    // swallows its own errors, so make sure it exists before setting a role.
    await q(
      `INSERT INTO public.users (id, email) VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
      [user.id, EMAIL],
    );

    // The role itself — this is the whole point. account_status back to
    // active and the device released, so a promote also un-sticks a
    // previously suspended or single-device-locked account.
    await q(
      `UPDATE public.users SET
         role = $2,
         account_status = 'active',
         onboarding_status = COALESCE(onboarding_status, 'complete'),
         active_session_id = NULL,
         updated_at = now()
       WHERE id = $1`,
      [user.id, ROLE],
    );

    // getProfile() (/api/auth/me) joins users ⨝ faculty and 404s without a
    // faculty row — which would send the super admin down the sign-up
    // funnel. Create one; its trigger issues credits + a trial, harmless
    // for a role that bypasses the subscription gate anyway.
    await q(
      `INSERT INTO public.faculty (user_id, organization)
         VALUES ($1, 'Murchid') ON CONFLICT (user_id) DO NOTHING`,
      [user.id],
    );

    // Leave a trace in the audit trail the console reads.
    await q(
      `INSERT INTO public.audit_log (actor_id, action, entity, entity_id, meta)
       VALUES ($1, $2, 'users', $1, jsonb_build_object('email', $3::text, 'via', 'db:superadmin'))`,
      [user.id, DEMOTE ? "superadmin.demote" : "superadmin.grant", EMAIL],
    );

    await q("COMMIT");

    console.log("\n─────────────────────────────────────────────");
    console.log(`${DEMOTE ? "Demoted" : "Super admin"}: ${EMAIL}`);
    console.log(`user id: ${user.id}${created ? "   (auth login created)" : ""}`);
    console.log(`role:    ${ROLE}`);
    console.log("─────────────────────────────────────────────");
    if (!DEMOTE) {
      console.log(
        "\nSign in at  /superadmin  " +
        (created || PASSWORD ? "with the email + password above" : "with that account (Google)") +
        ".\nYou land on the super-admin dashboard: platform analytics, every\n" +
        "account, billing controls, feature flags and the audit trail.",
      );
    }
  } catch (e) {
    await q("ROLLBACK").catch(() => {});
    console.error(`\n❌ Rolled back — nothing was changed.\n   ${e.message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
