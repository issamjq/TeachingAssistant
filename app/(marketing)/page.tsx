import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PIPELINE = [
  { step: "1", title: "Bring your curriculum", detail: "A syllabus, a prompt, textbooks, or notes — or pick from the shared library." },
  { step: "2", title: "AI drafts the term", detail: "Slides, notes, quizzes, exams, activities, and homework, generated together." },
  { step: "3", title: "You approve", detail: "Review and edit with a Studio assistant scoped to exactly what you're editing." },
  { step: "4", title: "It schedules itself", detail: "Approved material lands on the calendar and notifies your students automatically." },
];

const FAQ = [
  { q: "Who is Murchid for?", a: "Teachers, the institutions they work for, and the admins who oversee them — from a single classroom to a whole organisation." },
  { q: "Can students sign themselves up?", a: "No. A teacher or institution invites a student; there's no self-registration." },
  { q: "What if I don't have a detailed curriculum ready?", a: "Give the planner what you have. If it's not enough, it asks for the missing reference instead of guessing." },
];

export default function LandingPage() {
  return (
    <div>
      <header className="flex h-14 items-center justify-between px-6 md:px-10">
        <span className="text-sm font-semibold tracking-tight">Murchid</span>
        <Button asChild size="sm">
          <Link href="/signin">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-2xl px-6 py-16 text-center md:py-24">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          One clear pipeline for the whole term, not another feature pile.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Curriculum in. AI-drafted lessons, notes, quizzes, exams, and
          homework out. Approve once and it schedules and notifies itself.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/onboarding/teacher">Apply as a teacher</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/onboarding/organisation">Apply as an organisation</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          How it works
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((p) => (
            <Card key={p.step}>
              <CardContent className="p-5">
                <p className="text-xs font-medium text-primary">{p.step}</p>
                <p className="mt-2 text-sm font-semibold">{p.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Frequently asked
        </h2>
        <div className="space-y-6">
          {FAQ.map((item) => (
            <div key={item.q}>
              <p className="text-sm font-medium">{item.q}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        Murchid
      </footer>
    </div>
  );
}
