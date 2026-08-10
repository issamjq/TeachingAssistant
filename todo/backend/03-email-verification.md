# 03 · Email verification — `/api/auth/email-verify/*`

A 6-digit code proving an address during sign-up. Without this, email
sign-up stalls — Google and LinkedIn are unaffected.

Requires [00 · Setup](00-setup.md). Needs `bcryptjs` and a mail sender.

> **This is all that is left of `/api/auth`.** Provisioning and
> single-device claiming are the database's job now — `provision_faculty()`
> fires on faculty insert, and claiming is one UPDATE to
> `users.active_session_id`. Do **not** rebuild `/api/auth/supabase` or
> `/api/auth/claim-session`; `src/lib/data/entities.ts` handles both.
>
> `/api/auth/renew` is yours, though — changing plan is a payment, and a
> teacher cannot write `subscriptions`.

## Contract

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/auth/email-verify/send` | — | `{ ok, expiresAt }` |
| POST | `/api/auth/email-verify/check` | `{ code }` | `{ ok }` |

Both need a valid token but **no** faculty row — this runs before one
exists. The address comes from the verified token, never from the body:
taking it from the body lets anyone send codes to anyone.

## The table

Already migrated. RLS enabled with **no policy**, so it is unreachable
from any client — yours alone.

```
id  email  code_hash  expires_at  attempts  consumed_at  created_at
```

## The route

```js
import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { pool } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { handleErr, bad } from "../lib/errors.js";
import { sendVerificationCode } from "../lib/email.js";

const router = Router();
const TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 30_000;
const MAX_ATTEMPTS = 5;

const auth = requireAuth({ requireTeacher: false });

router.post("/email-verify/send", auth, async (req, res) => {
  try {
    const email = (req.authUser.email || "").toLowerCase();
    if (!email) throw bad("That account has no email address.");

    // Throttle on the newest UNCONSUMED code. Once one is used or has
    // expired the timer resets, so a legitimate retry is not punished
    // for an earlier success.
    const recent = await pool.query(
      `SELECT created_at FROM email_verifications
        WHERE email = $1 AND consumed_at IS NULL
        ORDER BY created_at DESC LIMIT 1`, [email]);
    if (recent.rows[0]) {
      const since = Date.now() - new Date(recent.rows[0].created_at).getTime();
      if (since < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - since) / 1000);
        return res.status(429).json({ error: `Wait ${wait}s before requesting another code.`, retryAfter: wait });
      }
    }

    // randomInt, not Math.random. This is a credential, however short.
    const code = String(randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);
    const expires = new Date(Date.now() + TTL_MS);

    // Drop any previous unconsumed code so only the newest can be
    // redeemed — otherwise a user juggling two emails can succeed with
    // the older one and be confused about which arrived.
    await pool.query(`DELETE FROM email_verifications WHERE email = $1 AND consumed_at IS NULL`, [email]);
    await pool.query(
      `INSERT INTO email_verifications (email, code_hash, expires_at) VALUES ($1,$2,$3)`,
      [email, codeHash, expires]);

    try {
      await sendVerificationCode({ to: email, code });
    } catch (err) {
      console.error("[email-verify] sender failed:", err);
      return res.status(502).json({ error: "Could not send the email. Try again in a moment." });
    }
    res.json({ ok: true, expiresAt: expires.toISOString() });
  } catch (err) {
    handleErr(res, "POST /api/auth/email-verify/send", err);
  }
});

router.post("/email-verify/check", auth, async (req, res) => {
  try {
    const email = (req.authUser.email || "").toLowerCase();
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) throw bad("Code must be 6 digits.");

    const { rows } = await pool.query(
      `SELECT id, code_hash, expires_at, attempts, consumed_at
         FROM email_verifications WHERE email = $1
        ORDER BY created_at DESC LIMIT 1`, [email]);
    const row = rows[0];

    if (!row)            return res.status(400).json({ error: "No code found — request a new one." });
    if (row.consumed_at) return res.status(400).json({ error: "Code already used — request a new one." });
    if (new Date(row.expires_at) < new Date())
                         return res.status(400).json({ error: "Code expired — request a new one." });
    if (row.attempts >= MAX_ATTEMPTS)
                         return res.status(429).json({ error: "Too many wrong attempts — request a new code." });

    if (!(await bcrypt.compare(code, row.code_hash))) {
      await pool.query(`UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
      const left = MAX_ATTEMPTS - (row.attempts + 1);
      return res.status(400).json({
        error: left > 0 ? `Wrong code — ${left} attempt${left === 1 ? "" : "s"} left.`
                        : "Too many wrong attempts — request a new code.",
      });
    }

    await pool.query(`UPDATE email_verifications SET consumed_at = now() WHERE id = $1`, [row.id]);
    // Lazy cleanup, keeping a day's tail for looking at recent activity.
    await pool.query(`DELETE FROM email_verifications WHERE expires_at < now() - interval '1 day'`);
    res.json({ ok: true });
  } catch (err) {
    handleErr(res, "POST /api/auth/email-verify/check", err);
  }
});

export default router;
```

## `src/lib/email.js`

```js
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.MAIL_FROM || "Murchid <hello@murchid.com>";

export async function sendVerificationCode({ to, code }) {
  if (!resend) {
    // In development, print it. Silently succeeding without sending is
    // how you spend an afternoon wondering why no email arrives.
    console.log(`[email] verification code for ${to}: ${code}`);
    return;
  }
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${code} is your Murchid code`,
    // The code in the subject too, so it is readable from a notification
    // without opening anything.
    text: `Your Murchid verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, ignore this email.`,
  });
}
```

## Rate limiting

These are the only guessable endpoints left in the service. Limit them
hard, and by IP **and** address — one alone is not enough.

```js
app.use("/api/auth/email-verify",
  rateLimit({ windowMs: 15 * 60_000, limit: 10 }),
  authRouter);
```

## Checklist

- [ ] Address from the verified token, never the body
- [ ] `randomInt`, not `Math.random`
- [ ] Only the hash stored
- [ ] 30s resend cooldown; 5 attempts; 10 min TTL
- [ ] Previous unconsumed codes deleted on resend
- [ ] Works with no faculty row
- [ ] Dev fallback logs the code rather than failing quietly
