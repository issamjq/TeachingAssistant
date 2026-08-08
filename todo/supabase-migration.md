# Supabase migration — required actions

Status as of commit `8e63cb7` ("Replace Firebase + Neon with Supabase for auth
and database").

The code migration is **done and verified**. What remains is configuration that
can only be done from the Supabase and hosting dashboards. **Sign-in does not
work until items 1–4 are complete**, so treat these as blocking, not cleanup.

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

### 4. Set the hosting environment variables

Nothing in the code reads `NEXT_PUBLIC_FIREBASE_*` anymore, so production
sign-in fails until these are replaced.

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

### 6. Run the end-to-end auth check

This is the one thing that could not be verified during the migration, because
obtaining a real user access token requires the Admin API.

```bash
npm run dev                                  # in one terminal
SUPABASE_SECRET_KEY=sb_secret_… npm run verify:auth
```

Creates a pre-confirmed throwaway user, signs in, exercises the bootstrap +
every studio surface + the role gate, then deletes the user and its account row.

Expect all checks `ok`. It also asserts the negative cases: no token → 401, and
a forged token → 401.

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

### 8. Row Level Security

Every table currently has RLS **disabled**. That is not a live vulnerability —
the publishable key is never used to read data; all access goes through the
Express API using the pooler connection, which bypasses RLS anyway.

It becomes urgent the moment any browser code calls `supabase.from(...)`
directly. If that's ever planned, enable RLS and write policies *first*.

### 9. Decommission Firebase

Once sign-in is confirmed working on Supabase, delete the Firebase project (or
at least revoke the service-account key). Leaving it live keeps a second,
unmonitored identity provider holding user records.

### 10. Delete dead code

`src/views/PortalSignIn.jsx` is no longer imported — all five portal routes use
`src/features/portal/components/PortalSignIn.tsx`. Left in place because
removing legacy views belongs to Phase 4 of the Next.js migration, but it still
describes the old popup flow and will mislead.

### 11. Refresh the docs

`docs/03-tech-stack.md` and `docs/04-architecture.md` still describe Vite,
Firebase and Neon. `CLAUDE.md` has been updated; these have not.
