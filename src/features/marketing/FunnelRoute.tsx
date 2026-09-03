"use client";

import { useRouter } from "next/navigation";
import Landing from "@/views/Landing";
import { navigate } from "@/lib/route";
import { getRole } from "@/lib/role";
import { DEFAULT_ROUTE } from "@/config/nav";

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
  const router = useRouter();
  return (
    <Landing
      initialPage={mode}
      /**
       * Back to home means the marketing site, which is a route.
       *
       * Landing.jsx carries a `page === "home"` of its own that renders
       * LandingHome — the landing "/" stopped using when the marketing
       * site was rebuilt. Flipping to it left a teacher looking at the
       * old page, at /signin, with the real one one click away.
       */
      onHome={() => router.push("/")}
      // Landing names a destination when it has one. When it does not, the
      // right default is whatever this role's home is — "planner" belongs
      // to a teacher, and sending a student there only made the studio
      // shell bounce them somewhere else a moment later.
      onOpenStudio={(where?: string) => navigate([where ?? DEFAULT_ROUTE[getRole()]])}
    />
  );
}
