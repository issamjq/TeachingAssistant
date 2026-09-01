import Script from "next/script";
import { clarityProjectId, isClarityEnabled } from "@/config/env";

// Microsoft Clarity — session replay and heatmaps.
//
// This is Microsoft's own tag, verbatim, rather than the @microsoft/clarity
// npm package. The package is a thin wrapper that injects exactly this
// snippet; using it would mean a dependency, a "use client" boundary and a
// mount effect to do what six inlined lines already do from a server
// component. The wrapper's value is its typed identify/setTag/event
// helpers — those are available here too, as `window.clarity("identify", …)`,
// which is literally what the package calls.
//
// The queue is the load-bearing part: window.clarity exists and buffers
// calls from the moment this runs, so anything the app reports during boot
// survives until the real script arrives and drains it.
const TAG = `
(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${clarityProjectId}");
`;

export default function Clarity() {
  // Off in `npm run dev`, so a morning of hot reloads doesn't land in the
  // recordings as a hundred one-second sessions. See src/config/env.ts.
  if (!isClarityEnabled) return null;

  return (
    // afterInteractive, not beforeInteractive: analytics has no claim on
    // the critical path, and the tag is only useful once there is a page to
    // record. beforeInteractive would put a third-party request ahead of
    // hydration on every route.
    <Script
      id="ms-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: TAG }}
    />
  );
}
