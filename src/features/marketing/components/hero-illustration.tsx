import { CheckCircle2, Sparkles } from "lucide-react";

/**
 * A composed product mockup, not a screenshot — three cards standing in
 * for one Goal Planner pass (input → draft → scheduled) inside concentric
 * rings, echoing the reference layout without claiming to be real product
 * UI.
 */
export function HeroIllustration() {
  return (
    <div className="relative mx-auto flex h-[420px] w-full max-w-md items-center justify-center md:h-[480px]">
      <div className="absolute inset-0 rounded-full border border-primary/15" />
      <div className="absolute inset-8 rounded-full border border-primary/10" />

      {/* Input card */}
      <div className="absolute left-0 top-6 w-48 rounded-2xl bg-primary p-4 text-primary-foreground shadow-xl md:top-10">
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
      <div className="absolute bottom-6 right-0 w-56 rounded-2xl border border-border bg-card p-4 shadow-xl">
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
      <div className="absolute right-6 top-0 flex items-center gap-2 rounded-full bg-lime px-3.5 py-2 text-lime-foreground shadow-lg md:top-2">
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
