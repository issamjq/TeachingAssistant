import Link from "next/link";

export function OnboardingShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="theme-marketing min-h-svh bg-background text-foreground">
      <header className="mx-auto flex max-w-lg items-center justify-between px-6 pt-8">
        <Link href="/" aria-label="Murchid home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/murchid-logo-green.svg" alt="Murchid" className="h-7 w-auto" />
        </Link>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          {label}
        </span>
      </header>
      <div className="mx-auto max-w-lg px-6 py-10">{children}</div>
    </div>
  );
}
