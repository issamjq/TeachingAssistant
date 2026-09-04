import Link from "next/link";

import { Button } from "@/components/ui/button";
import { HeroIllustration } from "./hero-illustration";

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-14 md:grid-cols-2 md:items-center md:px-8 md:pb-24 md:pt-20">
      <div>
        <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-foreground md:text-6xl">
          One clear pipeline for the whole term —{" "}
          <span className="text-primary">not another feature pile.</span>
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-foreground/70">
          Bring your curriculum. Murchid drafts the term&apos;s lessons, notes,
          quizzes, exams, activities, and homework together — you review once,
          and it schedules and notifies itself.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 rounded-full bg-lime px-7 text-base text-lime-foreground hover:bg-lime/90">
            <Link href="/onboarding/teacher">Apply as a teacher</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-primary/30 px-7 text-base">
            <Link href="/onboarding/organisation">Apply as an organisation</Link>
          </Button>
        </div>
        <p className="mt-5 text-sm text-foreground/60">
          Teachers, organisations, and the admins who oversee them — one
          approval step, no self-serve student accounts.
        </p>
      </div>

      <HeroIllustration />
    </section>
  );
}
