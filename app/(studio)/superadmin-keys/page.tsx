import type { Metadata } from "next";
import { KeyPoolRoute } from "@/features/key-pool";

// Role-gated surface. StudioShell bounces any section not in
// SECTIONS_BY_ROLE for the signed-in role, and the backend re-checks
// every /api/superadmin/* path with requireRole('superadmin') — so this
// segment carries no authorisation logic of its own.
export const metadata: Metadata = {
  title: "Key pool — Murchid",
  robots: { index: false, follow: false },
};

export default function SuperadminKeysPage() {
  return <KeyPoolRoute />;
}
