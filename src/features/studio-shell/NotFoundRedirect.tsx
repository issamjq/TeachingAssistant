"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRole } from "@/lib/role";
import { getAccount } from "@/lib/account";
import { DEFAULT_ROUTE } from "@/config/nav";
import BrandLoader from "@/components/BrandLoader";

// Reproduces the pre-migration recovery from an unknown path.
//
// The old SPA caught every path: App.jsx checked SECTIONS_BY_ROLE and
// replace()d anything unrecognised to the role's default section, while an
// unauthenticated visitor was cleared back to "/". Nothing 404'd. Now that
// routes resolve natively, that recovery has to be explicit.
//
// replace(), not push(), so the bad URL doesn't sit in history and send the
// user straight back to it with the back button.
export default function NotFoundRedirect() {
  const router = useRouter();

  useEffect(() => {
    const account = getAccount();
    if (!account) {
      router.replace("/");
      return;
    }
    router.replace(`/${DEFAULT_ROUTE[getRole()]}`);
  }, [router]);

  // The brand loader rather than a 404 screen: this state is transient and a
  // "not found" flash would be misleading for a path the app is about to
  // recover from on its own.
  return <BrandLoader />;
}
