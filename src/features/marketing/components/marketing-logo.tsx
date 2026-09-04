import { cn } from "@/lib/utils";

/**
 * public/murchid-logo-green.svg — the real wordmark (public/murchid-logo.svg,
 * live elsewhere in the product) recolored from its native cream/peach into
 * this page's dark-green/lime pair, so it reads straight off the cream
 * background with no chip behind it. A plain <img> on purpose — Next's
 * image optimizer blocks local SVGs unless images.dangerouslyAllowSVG is
 * opted into, which isn't warranted for a file this small.
 */
export function MarketingLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/murchid-logo-green.svg"
      alt="Murchid"
      className={cn("h-8 w-auto", className)}
    />
  );
}
