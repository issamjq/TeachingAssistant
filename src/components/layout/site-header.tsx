import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export function SiteHeader({
  homeHref,
  label,
}: {
  homeHref: string;
  label: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <Link href={homeHref} aria-label="Murchid home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/murchid-logo-green.svg" alt="Murchid" className="h-5 w-auto" />
      </Link>
      <Badge variant="outline">{label}</Badge>
    </header>
  );
}
