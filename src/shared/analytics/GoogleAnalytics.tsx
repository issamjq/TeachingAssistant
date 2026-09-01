import Script from "next/script";
import { gaMeasurementId, isGaEnabled } from "@/config/env";

// Google Analytics 4 — the gtag.js tag, verbatim from the GA console.
//
// Not @next/third-parties/google. That package is still marked
// experimental in Next 16's own docs, and its <GoogleAnalytics> renders
// this exact snippet; taking the dependency would buy a `sendGAEvent`
// helper over `window.gtag("event", …)`, which is what it calls anyway.
// Same reasoning that keeps the Clarity tag inline — see Clarity.tsx.
//
// SPA NAVIGATION IS NOT WIRED HERE, on purpose. The studio moves between
// screens with history.pushState (src/lib/route.js) and never reloads, so
// `config` below only ever fires one page_view by itself. GA4's Enhanced
// Measurement covers this: "Page changes based on browser history events"
// is on by default and patches pushState/replaceState to report the rest.
// If that setting is ever turned off in the GA property, this file is
// where the manual page_view on route change belongs.
const BOOTSTRAP = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaMeasurementId}');
`;

export default function GoogleAnalytics() {
  // Off in `npm run dev` — a morning of hot reloads is not traffic, and
  // GA has no dev/prod separation to filter it out with afterwards.
  if (!isGaEnabled) return null;

  return (
    <>
      {/* The inline half runs FIRST, and that ordering is load-bearing:
          it defines window.dataLayer and queues `js` and `config` into
          it, so the async loader below drains a queue that is already
          complete however late it arrives. Reversed, a slow tag would be
          racing the page for the first page_view. */}
      <Script
        id="ga-bootstrap"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: BOOTSTRAP }}
      />
      {/* afterInteractive, not beforeInteractive: analytics has no claim
          on the critical path (same call as Clarity). */}
      <Script
        id="ga-tag"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
      />
    </>
  );
}
