// The public face of the marketing feature. Other features import from
// here, never from a file inside — see the no-restricted-imports rule in
// eslint.config.mjs.
//
// billingMode.ts is deliberately NOT re-exported. It is the server-side
// read, and the comment in that file explains why that matters: rendering
// the price on the server is the whole point, because a client-side fetch
// makes every visitor watch three price cards flash past during a free
// period, and every crawler index the wrong one. Every component below is
// "use client". Putting both behind one specifier would let a client
// importer pull the server read into the browser bundle — the exact thing
// the split exists to prevent. Server callers import billingMode directly.
export { default as LandingPage } from "./LandingPage";
export { default as LegalSheet } from "./LegalSheet";
export { default as ResetPassword } from "./ResetPassword";
export { default as FunnelRoute } from "./FunnelRoute";
export { useBillingMode } from "./useBillingMode";
