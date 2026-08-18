# 13 — Student invites

A student is a roster row a teacher typed in. Two separate things have to
happen before they can sign in, and until now only the first did:

1. **The gate opens.** `invite_status` goes `none → invited`. Only then
   may someone signing in with that email claim the row
   ([`db/tune.sql` §35](../db/tune.sql), `link_student_account()`). An
   email match alone is deliberately not enough — otherwise anyone who
   guessed a classmate's address could sign in as them.
2. **The student is told.** They get an email with a link that signs them
   in and lands them on their dashboard.

`inviteStudent()` did only (1). Pressing **Invite** changed a label from
`Invite` to `Invited` and sent nothing, which is what "the invite isn't
sending" was.

## How the mail is sent

Through **Supabase Auth's own mailer**, called from the teacher's browser
with the publishable key — `signInWithOtp()` in
[`src/lib/supabaseAuth.js`](../src/lib/supabaseAuth.js). This is the only
mail this repo can send: the Resend integration lives on the separate
backend service and is still in test mode (it delivers only to the Resend
account owner's address).

So the invite **is** the magic link. There is no separate "you have been
added" notification, because Supabase's mailer only sends auth mail.

`shouldCreateUser` is true: an invited student has no auth identity yet.
The account it mints is inert — it cannot become a teacher, because the
studio needs a `faculty` row and nothing creates one for them.

## Two dashboard settings this depends on

Both are in the Supabase dashboard, and the invite silently fails to
arrive without them.

**1. Allowlist the redirect** — Authentication → URL configuration →
Redirect URLs must include `<your-origin>/student` for every origin you
run (localhost, preview, production).

**2. Rewrite the Magic Link template** — Authentication → Email templates
→ Magic Link:

```html
<a href="{{ .SiteURL }}/student?token_hash={{ .TokenHash }}&type=magiclink">
  Sign in to Murchid
</a>
```

This one is not optional, and the reason is worth understanding. The
browser client runs `flowType: "pkce"`, so the default template's
`{{ .ConfirmationURL }}` comes back as `?code=…` — and a code is useless
without the verifier held in the browser that **asked** for the link.
That browser is the teacher's. The student clicks on their own phone,
where no verifier exists, and the sign-in fails.

A token hash carries no device state, so it survives the hop.
`completeTokenHashSignIn()` verifies it on `/student`; the same-device
`?code=` path still works, handled by `detectSessionInUrl` before that
runs. Both link styles are accepted.

## Rate limits

Supabase's built-in SMTP allows only a handful of messages an hour. That
is the failure a teacher adding a class will actually hit, so:

- **Adding one student with an email invites them in the same action.**
- **Bulk import does not.** Thirty rows would deliver two. Imported
  students are invited one at a time from the list, and the import
  screen says so.
- A send that fails is reported on the returned student as
  `invite_mail_error`, not as a thrown error — the gate opened either
  way, and the screen still needs the row. The rate-limited case is
  named specifically rather than reported as a mystery.

**Configure a custom SMTP provider** (Project settings → Authentication →
SMTP) before real classes arrive. Nothing in the code changes when you
do.
