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

**Configure a custom SMTP provider** before real classes arrive. Nothing
in the code changes when you do — Supabase keeps sending the same magic
link, through a different pipe.

## Sending through Resend

Resend is the provider this project uses. It is **configuration, not
code**: no Resend key belongs in this repository, and none is read by it.
A Resend key is a server secret — putting it behind `NEXT_PUBLIC_` would
inline it into the browser bundle and hand every visitor the ability to
send mail as you.

> **Checked 2026-08-18.** The Resend key sends: a probe from Resend's
> shared sender to their sandbox inbox was accepted. A send from
> `no-reply@murchid.com` was refused with *"The murchid.com domain is not
> verified"*. So the account and the pipe are fine and **domain
> verification is the only thing between here and real delivery**.
> `murchid.com` exists with DNS at GoDaddy, so this is a DNS task.

### Why it has to be an SMTP provider

Resend is not what sends the invite — **Supabase is**, and Resend is the
SMTP server it hands the message to. That slot wants a host, a port and a
credential.

This rules out browser-side mail APIs such as EmailJS: they expose no
SMTP endpoint, so there is nothing to put in Supabase's settings. And the
reason Supabase must be the sender at all is that the invite is a **magic
link** — an auth token only Supabase can mint. No third-party mailer can
produce one.

A different design is possible — send a plain "your teacher added you, go
to /student and sign in" notification through any mail API, and let the
student start their own sign-in — which would also sidestep the PKCE
cross-device problem above. It costs the one-click link, and on the
services that make it attractive it buys a *lower* monthly allowance than
Resend's, not a higher one. It is not the design in the code.

### 1. Verify a sending domain (Resend)

Resend → Domains → add your domain, then publish the DKIM/SPF records it
gives you. **Until a domain is verified, Resend only delivers to the
account owner's own address** — which is what "test mode" means in
[todo/backend-integration.md](../todo/backend-integration.md), and why an
invite to a student appears to send and never arrives.

This is the actual gate on volume. Nothing else raises it.

### 2. Point Supabase at it

Supabase dashboard → Project settings → Authentication → **SMTP settings**
→ enable custom SMTP:

| | |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (TLS) — `587` also works |
| Username | `resend` — literally that word, not an address |
| Password | the Resend API key (`re_…`) |
| Sender email | an address **on the verified domain** |
| Sender name | Murchid |

Use a **send-only** restricted key here, not a full-access one. Supabase
needs nothing but the ability to send.

### 3. Raise the auth rate limit — the step that is easy to miss

Custom SMTP alone does **not** lift Supabase's own cap. Supabase →
Authentication → **Rate limits** → *Emails sent per hour* still applies,
and its default is small. Set it to whatever a real day looks like: a
teacher inviting two classes is 60 messages in a few minutes.

Both limits are real and independent — Resend's plan allowance, and
Supabase's per-hour auth cap. The one you hit first is the one you feel.

### 4. Then reconsider bulk invites

Bulk import deliberately does not invite, because on the built-in mailer
thirty rows delivered two. Once the two limits above are raised that
reasoning no longer holds, and inviting a whole imported class becomes
reasonable. It is a deliberate change, not an automatic one — see
`bulkCreateStudents` in [src/lib/data/entities.ts](../src/lib/data/entities.ts).

## Signing in without the email

The email is a convenience, not the mechanism. What lets a student in is
`invite_status = 'invited'` on a roster row carrying their address — so a
student whose invite never arrived, or who never opened it, signs in with
that same address and gets their dashboard.

The check lives in **`provisionTeacher()`**, not in the funnel. That is
the only place a `faculty` row is ever created, and a faculty row is what
makes someone a teacher for good — so the question has to be asked before
it is written. The landing page mints a teacher from two separate
branches (the social fast-track, and the plan picker at the end of the
email wizard); a check bolted onto one left the other open, and an
invited student who signed up with the same address came out the far side
a teacher with a trial, an empty studio and a blank role.

> **Edge case, deliberately accepted.** Someone who is genuinely a
> teacher *and* on another teacher's roster is diverted to the student
> side when they sign up, because at that moment the two are
> indistinguishable and the wrong guess is much more expensive in one
> direction than the other. A super admin can grant them the faculty row
> afterwards, and `my_roles()` then reports both.

That works at **every** door now:

- `/student` already called `link_student_account()` on an unrecognised
  session.
- The main funnel did not. A 404 from `/api/auth/claim-session` means no
  *teacher* row, which the landing page read as "new user" and turned an
  invited student into a teacher. It now tries the student link first,
  and only falls through to the sign-up funnel when that finds nothing.
- Neither did a **return visit**. A student already signed in who comes
  back to `/` got a 404 from `/api/auth/me`, which the page swallowed —
  leaving them on a marketing site offering to sign them up. It now
  claims their roster row and the CTAs take them to their dashboard.
- And `onOpenStudio()` with no destination sent everyone to `planner`,
  which belongs to a teacher. It follows the role's home instead, so a
  student is not bounced out of a screen a moment after arriving.

### The empty role

`users.role` allows NULL, which §30 described as "a brand-new account
before a role is decided". In practice it was the account showing a blank
role in the console and landing on the teacher dashboard, because every
reader of a NULL role falls back to `teacher` — the undecided state was
indistinguishable from the decision, except that it displayed as nothing.

§36 stops new rows arriving that way; §37 fills the backlog. Everyone
becomes `teacher`, which is how they were already being treated, and an
invited student is corrected to `student` the next time they sign in —
`link_student_account()` takes the slot precisely when it still holds the
default and no faculty row sits behind it.

## Invited by several teachers (§37)

A student on three teachers' rosters is three `students` rows, one per
teacher, each with its own `subject`, grade and section. Previously
`link_student_account()` claimed one (`ORDER BY created_at LIMIT 1`), so
two of the three invitations did nothing.

It now claims **every** invited, unclaimed row for the address, and is
re-runnable — a student invited by a fourth teacher next term calls the
same function and picks up only the new row. Holding a faculty row no
longer refuses the call either; that was the teacher-and-student case.

`current_student_ids()` is the set form of `current_student_id()`.
The singular one stays, and stays singular, because RLS policies authored
in the Supabase console are written in terms of it and this repo cannot
see them — it now answers with the **primary** row (the first a teacher
created) so those policies keep working rather than breaking on a student
who holds three. Everything in `tune.sql` uses the set, including the
`quiz_attempts` student policy.

`student_dashboard()` reads across all of them and carries the subject
and teacher on each item, because in a merged list "Unit 4 quiz" does not
say whose it is. The dashboard shows a strip of subjects and a Subject
column only when there is more than one teacher; with one, nothing
changes.
