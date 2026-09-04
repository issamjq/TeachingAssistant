const STEPS = [
  {
    title: "Bring your curriculum",
    detail: "A syllabus, a detailed prompt, source textbooks and notes, or something picked from the shared material library.",
  },
  {
    title: "Murchid drafts the whole term",
    detail: "Slide decks, notes, quizzes, exams, activities, and homework — generated together, not one request at a time.",
  },
  {
    title: "You review and approve",
    detail: "Edit anything with a Studio assistant scoped to exactly that one document. If the draft is too thin to trust, it asks you for more instead of inventing content.",
  },
  {
    title: "It schedules and notifies itself",
    detail: "Approved material lands on the calendar automatically, and your enrolled students are notified — no manual re-entry.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-primary py-16 text-primary-foreground md:py-24">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 md:grid-cols-2 md:items-center md:px-8">
        <div className="order-2 md:order-1">
          <div className="mx-auto w-full max-w-sm rounded-3xl bg-card p-6 text-card-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <p className="font-serif text-lg font-semibold">Term 2 · Week 6</p>
              <span className="rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold text-lime-foreground">
                Notified · 28
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-secondary px-3.5 py-2.5">
                <span className="text-sm font-medium">Mon · Photosynthesis (Lesson)</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-secondary px-3.5 py-2.5">
                <span className="text-sm font-medium">Wed · Cell structure (Notes)</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3.5 py-2.5">
                <span className="text-sm font-medium">Fri · Unit quiz (Quiz)</span>
                <span className="text-xs text-primary/70">Auto-scheduled</span>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 md:order-2">
          <h2 className="text-3xl font-black tracking-tight md:text-4xl">
            Start a term in four steps.
          </h2>
          <ol className="mt-9 space-y-7">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lime text-sm font-bold text-lime-foreground">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-primary-foreground/70">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
