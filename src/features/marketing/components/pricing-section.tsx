import Link from "next/link";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

const FREE_INCLUDES = [
  "The full Goal Planner pipeline",
  "Studio assistants on every document",
  "Auto-scheduling and student notifications",
  "The shared material library",
];

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-black tracking-tight md:text-4xl">
          Simple, per-teacher pricing.
        </h2>
        <p className="mt-3 text-lg text-foreground/65">
          Billed to the teacher, not the institution — no seats to buy in
          bulk, no credits to track.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
        <div className="rounded-3xl border-2 border-primary bg-card p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Free</p>
          <p className="mt-2 text-4xl font-black tracking-tight">$0</p>
          <p className="mt-1 text-sm text-foreground/60">Apply and start planning today.</p>
          <ul className="mt-6 space-y-3">
            {FREE_INCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-foreground/80">{item}</span>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="mt-7 w-full rounded-full bg-lime text-lime-foreground hover:bg-lime/90">
            <Link href="/onboarding/teacher">Apply as a teacher</Link>
          </Button>
        </div>

        <div className="rounded-3xl border border-border bg-secondary/40 p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Pro</p>
          <p className="mt-2 text-4xl font-black tracking-tight text-foreground/40">Coming soon</p>
          <p className="mt-1 text-sm text-foreground/60">
            Monthly or annual, still flat per-teacher.
          </p>
          <ul className="mt-6 space-y-3">
            <li className="text-sm text-foreground/60">
              Everything in Free is what Murchid runs on today — Pro adds
              room to grow. We&apos;ll publish exactly what&apos;s in it
              before it&apos;s billable.
            </li>
          </ul>
          <Button disabled size="lg" variant="outline" className="mt-7 w-full rounded-full opacity-60">
            Not yet available
          </Button>
        </div>
      </div>
    </section>
  );
}
