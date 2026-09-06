import { Fragment } from "react";
import Image from "next/image";
import { BookOpen, Sparkles, CheckCircle2, CalendarCheck, MessagesSquare, Bot, ChevronRight } from "lucide-react";

const DESK_PHOTO =
  "https://images.unsplash.com/photo-1683921055230-c3ba01e70131?fm=jpg&q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0";

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

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl bg-primary p-9 text-primary-foreground lg:col-span-2">
          <h3 className="text-2xl font-bold tracking-tight">
            The Goal Planner pipeline
          </h3>
          <p className="mt-3 max-w-md text-primary-foreground/75">
            A syllabus, a prompt, source documents, or the shared material
            library — one input, one full term drafted at once.
          </p>

          <div className="mt-9 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
            {FLOW.map((step, i) => (
              <Fragment key={step.label}>
                <div className="flex flex-1 items-center gap-3 rounded-2xl bg-primary-foreground/10 px-4 py-4 sm:flex-col sm:justify-center sm:gap-2 sm:py-6 sm:text-center">
                  <step.icon className="size-6 shrink-0 text-lime" />
                  <span className="text-sm font-semibold">{step.label}</span>
                </div>
                {i < FLOW.length - 1 ? (
                  <ChevronRight className="hidden size-4 shrink-0 self-center text-primary-foreground/30 sm:mx-2 sm:block" />
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="relative min-h-[300px] overflow-hidden rounded-3xl">
          <Image
            src={DESK_PHOTO}
            alt="A desk with a laptop, notepad, and pen"
            fill
            sizes="(min-width: 1024px) 33vw, 90vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/10 to-transparent" />
          <p className="absolute inset-x-5 bottom-5 text-lg font-bold text-primary-foreground">
            Bring what you already have
          </p>
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
