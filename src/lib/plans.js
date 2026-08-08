// Single source of truth for membership pricing AND subscription length.
// Monthly is the anchor (29.99 AED/mo); quarterly and annual apply the
// "Standard" discount ladder (10% / 25%). Tweak here and every surface
// updates — including the backend's subscription_ends_at math.
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
// The Express backend imports it directly (backend/routes/auth.js, admin.js,
// owner.js, superadmin.js) to price subscriptions and compute
// subscription_ends_at. Node runs it as-is with no transpile step, so a .ts
// extension breaks the API server at boot with ERR_MODULE_NOT_FOUND.
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

// All plan IDs the backend will accept — paid cards PLUS the trial.
// Anything else is rejected at /api/auth/supabase as an invalid plan.
export const PLAN_IDS = /** @type {PlanId[]} */ ([...PLANS.map((p) => p.id), TRIAL_PLAN_ID]);
/** @param {string} id @returns {Plan | {id: PlanId, durationDays: number} | null} */
export const getPlan = (id) => {
  if (id === TRIAL_PLAN_ID) return { id: TRIAL_PLAN_ID, durationDays: TRIAL_DAYS };
  return PLANS.find((p) => p.id === id) || null;
};
