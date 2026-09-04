import { BookOpen, Sparkles, CheckCircle2, CalendarCheck, MessagesSquare, Bot } from "lucide-react";

const FLOW = [
  { icon: BookOpen, label: "Curriculum in" },
  { icon: Sparkles, label: "AI drafts" },
  { icon: CheckCircle2, label: "You approve" },
  { icon: CalendarCheck, label: "Scheduled" },
];

const CARDS = [
  {
    icon: Bot,
    title: "Studio assistants, scoped",
    body: "Every lesson, exam, and note has its own AI editor. It can only ever touch that one document — never the rest of your data.",
  },
  {
    icon: CalendarCheck,
    title: "Approve once, it schedules itself",
    body: "No re-entering a calendar by hand. Approved material lands on the timetable and reaches your students automatically.",
  },
  {
    icon: MessagesSquare,
    title: "Doubts become class material",
    body: "A student's question is anchored to the exact line it's about. Once a faculty member approves an answer, the whole class studying it can see it.",
  },
];

export function FeaturesGrid() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-black tracking-tight md:text-4xl">
          One pipeline, not a feature pile.
        </h2>
        <p className="mt-3 text-lg text-foreground/65">
          Everything below serves the same flow — curriculum in, an approved
          term out.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3 lg:grid-rows-2">
        <div className="flex flex-col justify-between rounded-3xl bg-primary p-8 text-primary-foreground lg:col-span-2 lg:row-span-2">
          <div>
            <h3 className="text-2xl font-bold tracking-tight">
              The Goal Planner pipeline
            </h3>
            <p className="mt-2 max-w-md text-primary-foreground/75">
              A syllabus, a prompt, source documents, or the shared material
              library — one input, one full term drafted at once.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-2 sm:flex-nowrap">
            {FLOW.map((step, i) => (
              <div key={step.label} className="flex flex-1 items-center gap-2">
                <div className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-primary-foreground/10 px-3 py-5 text-center">
                  <step.icon className="size-5 text-lime" />
                  <span className="text-xs font-semibold">{step.label}</span>
                </div>
                {i < FLOW.length - 1 ? (
                  <div className="hidden h-px w-4 shrink-0 bg-primary-foreground/25 sm:block" />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {CARDS.map((card) => (
          <div key={card.title} className="rounded-3xl border border-border bg-card p-7">
            <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <card.icon className="size-5" />
            </div>
            <h3 className="mt-5 text-lg font-bold">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/65">{card.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
