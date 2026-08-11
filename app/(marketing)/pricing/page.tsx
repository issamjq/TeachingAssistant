import { redirect } from "next/navigation";

// The marketing site is one scroll now. Pricing lives at #pricing, but
// this route stays so a link already shared with a head of department, or
// already indexed, still lands in the right place instead of 404ing.
export default function PricingPage() {
  redirect("/#pricing");
}
