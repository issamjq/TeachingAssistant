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
      <Link href={homeHref} className="text-sm font-semibold tracking-tight">
        Murchid
      </Link>
      <Badge variant="outline">{label}</Badge>
    </header>
  );
}
