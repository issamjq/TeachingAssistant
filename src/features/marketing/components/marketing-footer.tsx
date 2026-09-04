import Link from "next/link";

import { MarketingLogo } from "./marketing-logo";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#roles", label: "Who it's for" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
  { href: "/signin", label: "Sign in" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5 py-12 text-center md:flex-row md:justify-between md:px-8 md:text-left">
        <div>
          <Link href="/" aria-label="Murchid home" className="inline-flex">
            <MarketingLogo />
          </Link>
          <p className="mt-3 text-sm text-foreground/60">
            Curriculum in. A scheduled, notified term out.
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-foreground/60 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
