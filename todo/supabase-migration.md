# Supabase migration — remaining actions

The code migration is **done and verified**, and Google sign-in works in
production. What remains is configuration that can only be done from the
Supabase and hosting dashboards (none of it verifiable from the repo), plus
two pieces of repo cleanup. Email/password sign-up stays degraded until
item 1 is done; Microsoft sign-in until item 2.

*(Pruned 2026-08-11: the RLS follow-up is gone — RLS is now enabled on every
table with owner policies via `db/tune.sql`, and the browser talks to
Supabase directly. The env-var item is gone repo-side — no Firebase/Vite
variable is read anywhere; only the dashboard values remain to confirm.)*

*(Re-checked 2026-08-12: nothing here has moved. Items 1–3, 5, 7 and 8 are
dashboard-side and unverifiable from the repo; items 6, 9 and 10 remain
open in the repo — `scripts/verify-auth.mjs:19` still targets the deleted
`localhost:3001`, `src/views/PortalSignIn.jsx` is still present and
unimported, docs 03/04 and `CLAUDE.md` still describe removed structure.
One caveat on the 08-11 prune note above: the RLS **policies** exist, but
nothing exercises them adversarially — that test suite is tracked as a
top frontend-only item in `new-docs/STATUS.md`.)*

---

## 🔴 Blocking — sign-in is broken until these are done

### 1. Turn OFF "Confirm email"

**Where:** Supabase dashboard → Authentication → Providers → Email → *Confirm email*

**Why it blocks:** the project currently reports `mailer_autoconfirm: false`.
With confirmation on, `signUp()` returns a user but **no session** — so the very
next call in the sign-up flow (`POST /api/auth/email-verify/send`, which reads
the email off the access token) has no token to send and fails.

This is not a workaround: Murchid deliberately replaced link-based verification
with its own 6-digit code, because teachers clicked the link, landed on a
"verified ✓" page and never returned to the original tab. Supabase's own
confirmation email would both duplicate that step and withhold the token the
code flow depends on.

Until it's off, sign-up shows an explanatory message rather than a bare 401
(handled in `src/views/Landing.jsx`, `handleEmailPassword`).

### 2. Enable the Microsoft (Azure) provider

**Where:** Supabase dashboard → Authentication → Providers → Azure

**Why it blocks:** the project reports `azure: false`, so the "Continue with
Outlook" button fails. Google is already enabled and works.

⚠️ The Firebase Microsoft provider configuration does **not** carry over. This
needs its own Azure app registration:

1. Azure Portal → App registrations → New registration
2. Redirect URI (Web): `https://beftrmuhplksbsfsfunc.supabase.co/auth/v1/callback`
3. Certificates & secrets → New client secret
4. Paste the Application (client) ID + secret into Supabase
5. Set "Supported account types" to include personal Microsoft accounts, or
   teachers on `@outlook.com` / `@hotmail.com` will be rejected

If Microsoft sign-in isn't needed at launch, the alternative is to hide the
Outlook button rather than leave it failing.

### 3. Add redirect URLs

**Where:** Supabase dashboard → Authentication → URL Configuration → Redirect URLs

Supabase refuses any redirect target not on this list and silently sends the
user to the Site URL instead — which looks like "sign-in did nothing".

Add every origin the app runs on:

```
http://localhost:3000/**
https://<your-vercel-domain>/**
https://<your-production-domain>/**
```

The `/**` wildcard covers the params the flows append
(`/?completeEmailSignIn=1`, `/?resetPassword=1`).

Set **Site URL** to the production domain.

### 4. Confirm the hosting environment variables

Repo side this is done — nothing in the code reads any `VITE_*` or
`NEXT_PUBLIC_FIREBASE_*` variable. What can't be verified from here is the
dashboards; confirm the following are set and the Firebase-era ones deleted.

**Vercel** (frontend):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://beftrmuhplksbsfsfunc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |

**Render** (backend):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://beftrmuhplksbsfsfunc.supabase.co` |
| `DATABASE_URL` | the **pooler** string, port 6543 |

Delete the old `VITE_FIREBASE_*` / `NEXT_PUBLIC_FIREBASE_*` /
`FIREBASE_ADMIN_KEY_B64` / `GOOGLE_APPLICATION_CREDENTIALS` vars — they're dead,
and `GOOGLE_APPLICATION_CREDENTIALS` pointing at a missing Secret File is a
boot-time crash risk.

> ⚠️ Use the **Supavisor pooler** host (`aws-0-ap-southeast-1.pooler.supabase.com:6543`),
> not `db.beftrmuhplksbsfsfunc.supabase.co`. The direct host resolves to **IPv6
> only** and Render cannot reach it.
>
> Do **not** append `sslmode=require`. TLS is handled in `backend/lib/db.js` by
> pinning the Supabase root CA; this `pg` version reads `sslmode=require` as
> `verify-full`, which fails against the system trust store. See
> `backend/lib/supabaseCa.js`.

---

## 🟠 Security

### 5. Rotate the leaked secret key

The secret key `sb_secret_dJ3KA…` was pasted into a chat transcript and must be
considered compromised. It grants privileged, RLS-bypassing access.

**Where:** Supabase dashboard → Project Settings → API keys → secret → rotate

The publishable key is fine as-is — it's public by design.

The application never uses the secret key: the API verifies tokens against the
public JWKS. It's needed only by `scripts/verify-auth.mjs` (item 6).

---

## 🟡 Verification

### 6. Rewrite, then run, the end-to-end auth check

`scripts/verify-auth.mjs` **cannot pass as written**: it hard-codes
`http://localhost:3001` (the deleted Express server) and exercises routes —
`/api/auth/supabase`, `/api/me`, `/api/templates`, `/api/drafts` — that are
now answered inside the browser by `src/lib/data/`, never over HTTP. The
check it performs is still worth having; the script needs rewriting against
Supabase directly (sign a throwaway user in with `@supabase/supabase-js` and
exercise the PostgREST paths + RLS refusals) before it can run. Until then,
the manual pass in item 7 is the auth verification.

### 7. Manually confirm the OAuth redirect round-trip

The popup → redirect change is the largest behavioural difference and is worth
one manual pass, since the automated check uses password sign-in:

- [ ] Google sign-in from the landing funnel → returns → lands in the profile/plan funnel
- [ ] Google sign-in as an **existing** teacher → returns → goes straight to the studio
- [ ] Google sign-in at `/dev` (or another portal) → returns → correct console
- [ ] Sign in, then hit browser Back → does not get stuck mid-redirect
- [ ] Magic link (`sendEmailLink`) → click from inbox → completes
- [ ] Password reset → link → sets a new password

Sign-in now spans **two page loads**: the click parks intent in `sessionStorage`
(`murchid.signup.pending`) and provisioning happens on return. If a flow stalls
after the redirect, that key and the mount effects in `Landing.jsx` /
`PortalSignIn.tsx` are the place to look.

---

## 🟢 Follow-ups (non-blocking)

### 8. Decommission Firebase

Once sign-in is confirmed working on Supabase, delete the Firebase project (or
at least revoke the service-account key). Leaving it live keeps a second,
unmonitored identity provider holding user records.

### 9. Delete dead code

`src/views/PortalSignIn.jsx` is no longer imported — all five portal routes use
`src/features/portal/components/PortalSignIn.tsx`. The original reason to wait
("removing legacy views belongs to Phase 4") no longer applies: `src/legacy/`
and the catch-all route are already gone. It still describes the old popup
flow and will mislead; delete it.

### 10. Refresh the docs

`docs/03-tech-stack.md` and `docs/04-architecture.md` still describe Vite,
Firebase and Neon. `CLAUDE.md` has drifted too — it describes the
`app/[[...slug]]` catch-all, `src/legacy/` and `src/App.jsx`, all of which
have since been removed; the migration is well past "Phase 1 complete".
