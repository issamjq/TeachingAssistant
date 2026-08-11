"use client";

import Landing from "@/views/Landing";
import { navigate } from "@/lib/route";

// The sign-up / sign-in funnel, given a real URL.
//
// The funnel itself is untouched — same Supabase calls, same validation,
// same provider buttons. What changed is that it now lives at /signup and
// /signin instead of being React state inside "/". Before this, the primary
// CTA on the whole marketing site never changed the address bar, so a
// teacher who opened sign-up, hesitated, and pressed Back left the site
// rather than returning to the pitch — and nobody could share, bookmark or
// deep-link the funnel.

export default function FunnelRoute({ mode }: { mode: "signup" | "signin" }) {
  return (
    <Landing
      initialPage={mode}
      onOpenStudio={(where?: string) => navigate([where ?? "planner"])}
    />
  );
}
