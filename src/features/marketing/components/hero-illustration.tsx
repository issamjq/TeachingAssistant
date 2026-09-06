import Image from "next/image";
import { CheckCircle2, Sparkles } from "lucide-react";

const TEACHER_PHOTO =
  "https://images.unsplash.com/photo-1511629091441-ee46146481b6?fm=jpg&q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0";

/**
 * A real photo (Unsplash, standard license) as the hero's visual anchor,
 * with two composed product-mockup cards floating on top — not a
 * screenshot, so they don't claim to be captured UI. See docs/00-concept.md
 * for what these represent (Goal Planner input -> an approved, scheduled
 * term).
 */
export function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-md pb-6 pl-8 pr-4 pt-4">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl">
        <Image
          src={TEACHER_PHOTO}
          alt="A teacher writing on a chalkboard"
          fill
          priority
          sizes="(min-width: 768px) 420px, 90vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/70 via-primary/0 to-primary/10" />
      </div>

      {/* Input card */}
      <div className="absolute -left-4 top-0 w-48 rounded-2xl bg-primary p-4 text-primary-foreground shadow-xl md:-left-8">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-primary-foreground/70">
          <Sparkles className="size-3.5" />
          Goal Planner
        </div>
        <p className="mt-2 text-sm font-semibold leading-snug">
          Grade 6 Science — Term 2 syllabus.pdf
        </p>
        <p className="mt-3 text-[11px] text-primary-foreground/70">
          Drafting slides, notes, quiz, homework…
        </p>
      </div>

      {/* Approved term card */}
      <div className="absolute -bottom-2 right-0 w-56 rounded-2xl border border-border bg-card p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Week 6 · Photosynthesis</p>
          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
            <CheckCircle2 className="size-3" />
            Approved
          </span>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between rounded-lg bg-secondary px-2.5 py-1.5 text-xs">
            <span>Lesson · Mon</span>
            <span className="text-muted-foreground">Scheduled</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-secondary px-2.5 py-1.5 text-xs">
            <span>Quiz · Fri</span>
            <span className="text-muted-foreground">Scheduled</span>
          </div>
        </div>
      </div>

      {/* Notified pill */}
      <div className="absolute right-0 top-8 flex items-center gap-2 rounded-full bg-lime px-3.5 py-2 text-lime-foreground shadow-lg">
        <div className="flex -space-x-2">
          <span className="size-5 rounded-full border-2 border-lime bg-primary" />
          <span className="size-5 rounded-full border-2 border-lime bg-secondary-foreground/40" />
          <span className="size-5 rounded-full border-2 border-lime bg-primary/60" />
        </div>
        <span className="text-xs font-semibold">28 students notified</span>
      </div>
    </div>
  );
}
