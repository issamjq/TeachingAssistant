import Link from "next/link";

import { Button } from "@/components/ui/button";

export function ClosingCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 md:px-8 md:pb-24">
      <div className="rounded-3xl bg-lime px-8 py-14 text-center text-lime-foreground md:py-20">
        <h2 className="mx-auto max-w-xl text-3xl font-black tracking-tight md:text-5xl">
          Plan your next term in one pass.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lime-foreground/80">
          Apply as a teacher or an organisation — approval, not a demo call.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="h-12 rounded-full bg-primary px-7 text-base text-primary-foreground hover:bg-primary/90">
            <Link href="/onboarding/teacher">Apply as a teacher</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-lime-foreground/30 bg-transparent px-7 text-base text-lime-foreground hover:bg-lime-foreground/10">
            <Link href="/onboarding/organisation">Apply as an organisation</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
