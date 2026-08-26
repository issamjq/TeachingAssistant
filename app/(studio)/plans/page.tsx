import { redirect } from "next/navigation";

/**
 * ── PUBLIC TEST PERIOD ───────────────────────────────────────────────
 * There are no plans to show. Every teacher gets the same fixed grant of
 * credits, so this page has nothing to say and nothing to sell.
 *
 * It redirects rather than 404s for two reasons: an old bookmark or a
 * link in a sent email should land somewhere useful, and "Credits used"
 * is the page a teacher who typed /plans actually wanted — how much is
 * left and where it went.
 *
 * Kept as a redirect rather than deleted so restoring billing is one
 * revert of this file plus the nav entry, not an archaeology exercise.
 * The view itself (src/views/Plans.jsx) is untouched and still builds.
 */
export default function PlansPage() {
  redirect("/credit-usage");
}
