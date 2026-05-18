// Single source of truth for membership pricing. Monthly is the anchor
// (29.99 AED/mo); quarterly and annual apply the "Standard" discount
// ladder (10% / 25%). Tweak here and every surface updates.
//
//   perMonth  effective AED per month (what the big number shows)
//   total     AED actually charged each billing cycle
//   savePct   discount vs. paying monthly (0 = none)
//   cycle     i18n suffix key part: "mo" | "q" | "yr"
//   best      flags the highlighted "best value" card

export const CURRENCY = "AED";

export const PLANS = [
  { id: "monthly",   perMonth: "29.99", total: "29.99",  savePct: 0,  cycle: "mo" },
  { id: "quarterly", perMonth: "26.99", total: "80.99",  savePct: 10, cycle: "q"  },
  { id: "annual",    perMonth: "22.49", total: "269.99", savePct: 25, cycle: "yr", best: true },
];

export const PLAN_IDS = PLANS.map((p) => p.id);
export const getPlan = (id) => PLANS.find((p) => p.id === id) || null;
