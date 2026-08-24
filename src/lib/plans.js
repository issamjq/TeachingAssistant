// Single source of truth for membership pricing AND subscription length.
// Monthly is the anchor (29.99 AED/mo); quarterly and annual apply the
// "Standard" discount ladder (10% / 25%). Tweak here and every surface
// updates — including the backend's subscription end-date maths.
//
//   perMonth     effective AED per month (what the big number shows)
//   total        AED actually charged each billing cycle
//   savePct      discount vs. paying monthly (0 = none)
//   cycle        i18n suffix key part: "mo" | "q" | "yr"
//   durationDays how many days a single paid cycle lasts — fed into the
//                teacher's subscription_ends_at on sign-up
//   best         flags the highlighted "best value" card
//
// ⚠️ THIS FILE MUST STAY PLAIN JAVASCRIPT.
// The separate backend project imports it directly — the auth bootstrap
// prices a subscription and computes its end date from these same
// numbers, and duplicating them is how the pricing table and the charge
// come to disagree. Node runs plain JS with no transpile step, so a .ts
// extension would break that import.
//
// Types come from JSDoc instead — TypeScript reads them via allowJs, so
// frontend call sites are still fully typed.

/** @typedef {import("../shared/types/domain").Plan} Plan */
/** @typedef {import("../shared/types/domain").PlanId} PlanId */

export const CURRENCY = "AED";

// Trial is its own pseudo-plan — there's no card for it in the picker
// (the highlighted "Start 7-day free trial" CTA below the cards sends
// the teacher down this path). It survives the same code path on the
// backend as a real plan: status='trial', ends_at=now+TRIAL_DAYS.
export const TRIAL_DAYS = 7;
export const TRIAL_PLAN_ID = /** @type {const} */ ("trial");

export const PLANS = /** @type {Plan[]} */ ([
  { id: "monthly",   perMonth: "29.99", total: "29.99",  savePct: 0,  cycle: "mo", durationDays: 30 },
  { id: "quarterly", perMonth: "26.99", total: "80.99",  savePct: 10, cycle: "q",  durationDays: 90,  best: true },
  { id: "annual",    perMonth: "22.49", total: "269.99", savePct: 25, cycle: "yr", durationDays: 365 },
]);

// ---------------------------------------------------------------------
// What the product actually sells now.
//
// PLANS above is a BILLING CADENCE (monthly / quarterly / annual) and is
// still what sign-up posts and what the backend's plan_ids CHECK accepts.
// CREDIT_TIERS is the PRODUCT: three sizes of monthly allowance, every
// feature in each. The two are orthogonal — a tier is bought on either
// cadence — and conflating them is why the landing page spent months
// quoting a single 29.99 AED price that nothing charged.
//
// ⚠️ These mirror `plan_tiers` in db/tune.sql §79. The public landing page
// is statically rendered and unauthenticated, so it cannot call
// plan_options() the way /plans does — it needs constants. If the table
// changes, change these. `npm run test:e2e` is not going to catch it.
//
// usd/aed are the monthly charge; annualAed is the yearly one, set at ten
// months rather than twelve, which is where "two months free" comes from.
// lessons is the same equivalence /plans shows: credits ÷ 8, a full lesson
// being 8 credits.
export const CREDIT_TIERS = [
  { id: "basic", name: "Basic", credits: 120, usd: 12, aed: 45,  annualUsd: 120, annualAed: 450,  lessons: 15 },
  { id: "pro",   name: "Pro",   credits: 350, usd: 35, aed: 129, annualUsd: 350, annualAed: 1290, lessons: 43, best: true },
  { id: "max",   name: "Max",   credits: 800, usd: 80, aed: 295, annualUsd: 800, annualAed: 2950, lessons: 100 },
];

/**
 * What a year saves, as a percentage, worked out rather than asserted.
 *
 * Written as a function so the badge cannot drift from the prices beside
 * it: change annualAed and the number moves with it.
 *
 * @param {{ aed: number, annualAed: number }} tier
 */
export const annualSavePct = (tier) =>
  Math.round((1 - tier.annualAed / (tier.aed * 12)) * 100);

/** How many months a year costs, for "two months free". @param {{ aed: number, annualAed: number }} tier */
export const annualFreeMonths = (tier) =>
  Math.round(12 - tier.annualAed / tier.aed);

// All plan IDs the backend will accept — paid cards PLUS the trial.
// Anything else is rejected at /api/auth/supabase as an invalid plan.
export const PLAN_IDS = /** @type {PlanId[]} */ ([...PLANS.map((p) => p.id), TRIAL_PLAN_ID]);
/** @param {string} id @returns {Plan | {id: PlanId, durationDays: number} | null} */
export const getPlan = (id) => {
  if (id === TRIAL_PLAN_ID) return { id: TRIAL_PLAN_ID, durationDays: TRIAL_DAYS };
  return PLANS.find((p) => p.id === id) || null;
};
