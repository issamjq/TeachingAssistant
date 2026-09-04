> **Built 2026-09-04.** All three endpoints are live on `final/backend`
> exactly as specified below. Blocked only on a dashboard task, not
> code: the Stripe account has no recurring Murchid prices yet (two
> unrelated one-off products/prices exist instead), so `/checkout`
> answers `503 price_not_configured` until `STRIPE_PRICE_PRO_MONTHLY`/
> `STRIPE_PRICE_PRO_ANNUAL` are set in Render. Also worth checking
> before real money moves: the server key is `rk_live_…` (live mode) —
> confirm that's intentional, or switch to a test key while wiring the
> frontend UI. No teacher-facing "Upgrade"/"Manage billing" UI exists
> yet — that's next, once prices exist to actually test checkout
> against.

# Billing — flat monthly/annual per teacher

Pricing model confirmed: flat per-teacher subscription (Free / Pro),
billed monthly or annually — not per-organisation, not credit-based.
Stripe account already exists; this is the contract for whoever wires
checkout and the webhook.

## Already done, frontend/schema side

```sql
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  billing_period text check (billing_period in ('monthly', 'annual')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Full definition with RLS in `db/tune.sql` ("Subscriptions: flat
monthly/annual per teacher"). **No insert/update/delete policy exists
for any browser role, on purpose** — same principle as `credits`/
`usage_logs`/`audit_log`: a teacher cannot extend their own plan, and a
frontend bug can't fabricate a subscription. Only a backend process
using its own pooler connection (bypasses RLS, same pattern as
`recordAudit`/the key pool) can write this table. A row missing
entirely means free plan — the frontend doesn't need a row per
free-tier teacher.

`/super-admin/revenue` already reads this table for real (empty right
now, honestly labelled "checkout isn't wired up yet").

## What's needed on the backend

```
POST /api/billing/checkout
Authorization: Bearer <supabase access token>
→ { "plan": "pro", "billingPeriod": "monthly" | "annual" }
← 200 { "checkoutUrl": "https://checkout.stripe.com/..." }
```

Create or reuse a Stripe Customer for the caller (`profiles.email` /
`auth.uid()` — store the mapping on first checkout via
`stripe_customer_id`), create a Checkout Session for the matching
Stripe Price (four prices total: pro/monthly, pro/annual — plus
whatever trial policy is wanted), redirect-mode, success/cancel URLs
pointing back at the frontend.

```
POST /api/billing/portal
Authorization: Bearer <supabase access token>
← 200 { "portalUrl": "https://billing.stripe.com/..." }
```

Stripe's own Customer Portal for self-service plan changes/cancellation
— needs `stripe_customer_id` to already exist (i.e., the caller has
checked out at least once).

```
POST /api/billing/webhook
(No Supabase auth — Stripe signs the payload; verify with the webhook
signing secret, same pattern the old backend used for its Stripe
mount: raw body, verified before any JSON parsing, mounted before the
general body parser.)
```

Events to handle, each an upsert into `subscriptions` keyed on
`owner_id` (resolve via `stripe_customer_id` → `owner_id`, so store
that mapping on the customer's metadata at creation time):

| Event | Effect |
|---|---|
| `checkout.session.completed` | Set `plan='pro'`, `status='active'` (or `'trialing'`), `billing_period`, `stripe_subscription_id`, `current_period_end` |
| `customer.subscription.updated` | Sync `status`/`current_period_end` — covers renewals, plan changes, `past_due` |
| `customer.subscription.deleted` | Set `plan='free'`, `status='canceled'` |
| `invoice.payment_failed` | Set `status='past_due'` — don't immediately downgrade; Stripe's own retry schedule handles the grace period |

## Not decided here, worth settling before building

- **Trial policy** — does Pro start with a trial period, and how long?
- **Free-tier limits** — the product's free tier presumably caps
  something (classes, generations, students) to make Pro worth paying
  for. That's a product decision this doc doesn't make; whatever it is,
  the frontend reads it off `subscriptions.plan` once this exists.
- **Proration/downgrade behavior** — handled by Stripe's own portal by
  default; only worth custom-building if the default doesn't fit.

## What the frontend still needs, once this exists

No teacher-facing upgrade/billing UI exists yet — today only the
super-admin Revenue page reads `subscriptions`. Building "Upgrade to
Pro" (calls `/api/billing/checkout`) and "Manage billing" (calls
`/api/billing/portal`) is frontend work that follows once the backend
contract above is real, not blocking it.
