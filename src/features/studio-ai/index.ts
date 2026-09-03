// Public surface of the studio-ai feature. The route segment at
// app/(studio)/studio/ and other features import from here, never from a
// file inside — see the no-restricted-imports rule in eslint.config.mjs.
//
// studio-ai imports nothing from studio-shell or presentations, so the two
// features that consume this barrel cannot form a cycle through it.
export { default as StudioRoute } from "./components/StudioRoute";
export { SlideFullscreen } from "./artifacts";
export { CreditWarning } from "./CreditMeter";
