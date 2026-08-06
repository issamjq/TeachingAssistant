"use client";

import dynamic from "next/dynamic";

// Client-only mount for the legacy SPA.
//
// ssr: false is deliberate and load-bearing. The legacy tree reads
// window/localStorage at module scope in ~18 files (src/lib/account.js,
// route.js, i18n.jsx, and 10 views), which would throw during server
// rendering. Disabling SSR here reproduces exactly what index.html did —
// an empty shell that hydrates on the client — so Phase 1 changes nothing
// the user can see.
//
// Peeled routes opt back INTO server rendering individually. This escape
// hatch applies only to what's still inside the catch-all.
//
// `next/dynamic` with `ssr: false` is only permitted inside a client
// component, which is why this thin wrapper exists between the server
// page.tsx and the legacy root.
const LegacyRoot = dynamic(() => import("@/legacy/LegacyRoot.jsx"), {
  ssr: false,
});

export default function LegacyAppMount() {
  return <LegacyRoot />;
}
