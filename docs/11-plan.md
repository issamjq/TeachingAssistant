# 11 — Plan (2-week commercial spine)

> Written 2026-07-28 with Issa. This is the working plan, not history. Update it as reality changes.
>
> Companion doc: [12 — Findings](12-findings.md) — the running list of what's actually broken.

## The problem this plan solves

Murchid is **wide but shallow**: five role dashboards, ~50 views, six teaching surfaces, an AI studio, a slide editor, a marketing site with four heroes — and **no payment integration, no usage metering, and the AI flag off by default**. The build is impressive; the commercial spine is missing.

Two weeks to fix that. Not to add features.

---

## Unit economics — the number that governs everything

Revenue per teacher: **AED 29.99/mo ≈ $8.17**. On the annual plan (25% off): **$6.12/mo**. Plan against the annual case.

| Line | $/user/mo |
|---|---|
| Revenue (annual plan) | 6.12 |
| Payment processing (~3%) | −0.20 |
| Infra (Render + Neon + Vercel @ ~1k users) | −0.25 |
| **Available before AI** | **5.67** |
| Target 75% gross margin → **AI budget** | **≈ 1.40** |

Anthropic pricing per million tokens (verified 2026-07-28):

| Model | Input | Output |
|---|---|---|
| Haiku 4.5 | $1 | $5 |
| Sonnet 5 | $3 | $15 — **intro $2/$10 expires 2026-08-31** |
| Opus 5 | $5 | $25 |

Cache reads ≈ 0.1×. Cache writes 1.25× (5 min TTL) / 2× (1 hr). Batch API = 50% off.

What $1.40/month actually buys:

| Workload | Haiku 4.5 | Sonnet 5 | Opus 5 |
|---|---|---|---|
| Lesson plan (~2k in / 4k out) | $0.022 → ~63/mo | $0.066 → ~21/mo | $0.11 → ~13/mo |
| Slide deck (~2k in / 15k out) | $0.077 → ~18/mo | $0.23 → ~6/mo | $0.38 → ~4/mo |

### Three load-bearing conclusions

1. **`ai_studio` being off by default is the only thing preventing negative gross margin.** Metering ships before that flag flips on for real users.
2. **Output tokens dominate, not input.** Prompt caching matters less than people assume for first-draft generation. The levers are *model routing* and *output length caps*. Caching pays off on tweak/regenerate loops where full history is resent.
3. **A teacher making 10 decks/month on Opus costs $3.80** — more than the annual plan's entire margin. Credits are survival, not polish.

---

## Week 1 — Control the money

Goal: the AI can be switched on and every dirham of cost is visible per teacher, per day.

| Day | Build | Done when |
|---|---|---|
| **1** | **Usage ledger.** `ai_usage` table: account_id, feature, model, in/out/cache tokens, cost_usd, credits_charged, latency, status, request_id. Written on **every** Anthropic call, from `response.usage`. Plus a `model_pricing` table (prices in DB, not code). | One test generation produces one row with a real dollar cost |
| **2** | **Credits.** Balance per account, charged on *measured tokens* — never per action (a 3-slide and a 40-slide deck cannot cost the same). Internal peg ~1 credit = $0.01 cost; never exposed. | A zero-balance teacher gets a friendly block, not a generation |
| **3** | **Model routing** + `max_tokens` caps per feature. Quiz/homework/tweaks → Haiku. Lessons/slides/Arabic → Sonnet. Term plans / "make it excellent" → Opus. | Quiz costs visibly less than a lesson plan in the ledger |
| **4** | **Safety brakes.** Pre-flight `count_tokens` estimate shown before charging; per-`account_id` rate limits (today's limiter is per-IP — a whole school shares one bucket while one abusive account is unlimited); daily org spend cap wired to the existing `ai_studio` kill switch; prompt caching on the stable system prompt. | A $20/day cap actually trips |
| **5** | **Teacher credit screen** in `/account`: balance, usage this month by type, reset date, top-up button. | A teacher understands their balance without asking |
| **6–7** | **Owner margin dashboard.** Live gross margin; cost vs revenue per user by cohort; top-10 most expensive teachers; cost per feature; model mix + cache hit rate; alert when margin drops below target. | This is the screen you show an investor |

### Credit allocation

| Plan | Credits/mo | ≈ AI cost ceiling |
|---|---|---|
| Trial (7 days) | 40 | $0.40 |
| Monthly | 150 | $1.50 |
| Quarterly | 165 | $1.65 |
| Annual | 180 | $1.80 |
| Top-up pack | +100 | $1.00 → **sell at AED 15 (~85% margin)** |

Top-ups are the sleeper business: power users self-select into paying more, converting worst-margin users into best.

---

## Week 2 — Open the doors

Goal: teachers can sign up smoothly, pay real money, and we can see whether they stay.

| Day | Build | Notes |
|---|---|---|
| **8** | **Cut the clutter** (see cut list below). Fast day, mostly deleting and hiding. | ⚠️ **Decision needed today:** which payment provider |
| **9–10** | **Payments.** Provider integration, subscribe/upgrade/downgrade/cancel, **5% UAE VAT** + compliant tax invoices, failed-card dunning, wire the top-up button. | Biggest single job. `/api/auth/renew` is currently an empty placeholder — **there is no way to take money today** |
| **11** | **Retention instrumentation.** Activation (signup → first generation), WAU/MAU, cohort retention, feature adoption. | Today only `last_login_at` exists. No retention curve = no fundraise |
| **12–13** | **One real teacher feature: Differentiation.** One button → easier / core / stretch version of any lesson. | Cheap (reuses Studio), universal pain, no competitor does it well |
| **14** | **Careful switch-on.** Enable `ai_studio` for 10–20 real teachers. Watch the margin dashboard all day. Compare real cost against predictions. | Never open the gate for everyone at once |

### Success = these six are true on Day 14

1. Every AI call recorded with real dollar cost
2. No teacher can exceed their plan's spend
3. Live profit margin visible on one screen
4. A teacher can pay by card and get a proper invoice
5. Signup has no unnecessary steps and no wrongful lockouts
6. 10–20 real teachers generating, and the numbers match predictions

---

## Cut list (stop investing — not a deletion emergency)

| # | What | Why | Verdict |
|---|---|---|---|
| A1 | 6-digit email OTP after Google/Microsoft sign-in | Those providers already assert `email_verified`. Re-verifying costs a Resend bill and funnel drop-off for zero security gain | **Cut** for social. Keep for email+password |
| A2 | Single-device sign-in hard lockout | Classroom desktop + personal iPad = forced sign-out mid-lesson. Punishes best users to stop a problem we don't have | **Downgrade** to ~3 sessions + notice. Keep the session-id plumbing |
| A3 | MoE dashboard | Ministry procurement is a 12–24 month motion. Dashboard built, pipeline isn't | **Freeze** |
| A4 | Owner dashboard | Read-only metrics for one person = a scheduled email, not a bespoke React surface | **Replace** with digest |
| A5 | Admin sub-roles (operations/accountant/support) | Three dashboard variants for a one-person team | **Collapse to one** |
| A6 | 24-key permission matrix + per-account overrides | `permissions.js` says it applies "when feature-gating is wired in" — it isn't. Config UI built before enforcement | **Defer** the UI; keep `ROLE_DEFAULTS` |
| A7 | Four parallel hero components + 7.2k-line `Landing.jsx` | Four heroes competing for a page whose only job is "click Sign in" | **Pick one, delete three** |
| A8 | `localStorage` role-preview override | A client-side role switcher will read as a vulnerability to a school's IT reviewer | **Dev-only env flag** |
| A9 | Bulletin board, Library | Nav entries with no product thesis | **Remove from nav** |

---

## Teacher features (after the two weeks) — ranked by value per effort

**Tier 1 — differentiators**

1. **UAE MoE curriculum alignment.** Tag every lesson with the specific MoE learning outcome. This is the moat — ChatGPT writes lesson plans; it can't map to UAE Grade 7 Science outcome 3.2. It's what a principal buys.
2. **Differentiation** (Week 2, Day 12–13) — one lesson, three ability levels.
3. **Grading & feedback assistant.** Student work + rubric → per-student feedback and suggested mark. Biggest weekly time-sink; strongest "I'd pay for this alone". *Needs photo upload + rubric handling — 1–2 weeks on its own. First thing after this plan.*
4. **Parent communication generator.** Report-card comments and parent messages, EN/AR, tone-controlled. Brutal seasonal pain = strong retention hook.
5. **Arabic & Islamic Studies quality tier.** The Amiri typography promises it; generation quality must match. Underserved and defensible.

**Tier 2** — whole-unit/term planning · cover/substitute packs · voice input · timetable import (photo/Excel → schedule) · print-first exports · SEN/IEP support · **department library sharing (this is the viral loop, not a feature)**

**Tier 3** — student-facing quiz links with auto-marking · attendance analytics with at-risk flags · LMS export (Google Classroom / Teams) · mobile quick capture

---

## Investor-side priorities

1. **The margin dashboard.** Investors fund "we know our COGS per user and it's 22%, trending down" — not "we have AI".
2. **School / district plans.** The real business. 80 teachers × AED 25 on one invoice beats grinding CAC at AED 30/teacher. Needs seat management + a school admin console — **largely already built**; repoint the admin surface from "our staff" to "the school's HOD".
3. **Retention instrumentation** (Week 2, Day 11).
4. **PDPL compliance pack.** UAE Federal Decree-Law 45/2021 — DPA, data-residency statement, breach process, sub-processor list. Every school procurement asks. `src/lib/legal.js` is a real head start.
5. **Annual prepay push.** Already priced at 25% off — cheapest capital a pre-seed company gets.
6. **Referral loop.** Credits cost ~$0.01; a referred user costs nothing to acquire. Highest-ROI growth mechanic at this price point.
7. **Proprietary content corpus.** Every accepted/edited lesson is training signal → "better at UAE Grade 7 Science than GPT". The defensibility slide.
8. **Usage-based expansion revenue.** Top-ups + premium Opus tier → net revenue retention story.
9. **Design as moat.** The editorial aesthetic is genuinely 2–3 years ahead of this category. Protect it.

---

## Working rules

- **Touch a section → fix its bugs → add what it needs → leave it → don't come back.** No standalone polish sprints. Bugs found in sections we aren't working on go to [12 — Findings](12-findings.md).
- **Verify by running, not by reading.** Confirm behaviour in the live app before calling it a finding.
- **Model prices live in the database**, never hardcoded.

## Known risks

| Risk | Likelihood | Response |
|---|---|---|
| Payments takes 3 days not 2 | Likely | Day 12–13 feature slides. Payments wins |
| Real AI costs exceed estimates | Possible | Exactly why the ledger is Day 1 — find out in week 1, adjust credits |
| Serious Studio bugs surface Day 1–4 | Likely | Fix in place. Studio is the section we're in — that's the rule working |
| Scope creep mid-plan | Very likely | Write it down, start Day 15 |
