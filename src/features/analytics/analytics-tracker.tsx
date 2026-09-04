"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useSession } from "@/features/auth/session-context";
import { logClientError, logPageView } from "@/lib/data/analytics";

export function AnalyticsTracker() {
  const { user } = useSession();
  const pathname = usePathname();
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    logPageView(user.id, pathname);
  }, [user, pathname]);

  useEffect(() => {
    function onError(event: ErrorEvent) {
      const ownerId = userIdRef.current;
      if (!ownerId) return;
      logClientError(ownerId, event.message ?? "Unknown client error");
    }
    function onRejection(event: PromiseRejectionEvent) {
      const ownerId = userIdRef.current;
      if (!ownerId) return;
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      logClientError(ownerId, reason);
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
