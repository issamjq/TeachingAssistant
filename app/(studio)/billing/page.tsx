import { redirect } from "next/navigation";

/**
 * ── PUBLIC TEST PERIOD ───────────────────────────────────────────────
 * Nobody is charged during the public test, so there is no invoice
 * history to show and no card on file to manage. Redirects to the usage
 * page for the same reason /plans does — see that file.
 *
 * src/views/Billing.jsx is left in place, unimported and unrouted, so
 * this is a one-file revert when billing comes back.
 */
export default function BillingPage() {
  redirect("/credit-usage");
}
