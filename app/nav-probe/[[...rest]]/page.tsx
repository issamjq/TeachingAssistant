import { notFound } from "next/navigation";
import NavProbe from "../NavProbe";

// Test harness for the routing shim (src/lib/route.tsx). NOT a product route.
//
// Why this exists: the shim's riskiest assumption is that router.push()
// between two paths served by the SAME catch-all segment still re-renders.
// If that were a no-op, in-app navigation would silently break across the
// whole app while the URL bar kept updating — and every route peeled in
// Phase 3 depends on it working.
//
// It can't be verified through the real UI, because every in-app navigation
// on the landing page is behind authentication and the smoke suite runs
// without credentials. This page exposes navigate()/replace()/setNavGuard()
// as buttons so tests/e2e/navigation.spec.ts can drive them directly.
//
// Excluded from production builds — see notFound() below. Delete alongside
// the shim in Phase 4.

export default function NavProbePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <NavProbe />;
}
