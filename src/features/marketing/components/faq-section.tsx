import { ChevronDown } from "lucide-react";

const FAQ = [
  {
    q: "Who is Murchid for?",
    a: "Teachers, the institutions they work for, and the admins who oversee them — from a single classroom to a whole organisation.",
  },
  {
    q: "Can students sign themselves up?",
    a: "No. A teacher or institution invites a student by email; there's no self-registration.",
  },
  {
    q: "What if I don't have a detailed curriculum ready?",
    a: "Give the planner what you have. If it isn't enough to work from, it asks you for the missing reference or detail instead of inventing curriculum content — at every generation step, not just the first.",
  },
  {
    q: "What happens after I apply?",
    a: "Your account starts pending. It becomes active once approved by a super admin, a delegated sub admin, or the specific organisation you applied to — only an active teacher can create classes or add students.",
  },
  {
    q: "Who can see my students' data?",
    a: "Access is enforced by the database itself, not just the app — a teacher's queries are scoped to their own classes and students by row-level security, the same policy that runs the rest of the platform.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
      <h2 className="text-center text-3xl font-black tracking-tight md:text-4xl">
        Frequently asked.
      </h2>

      <div className="mt-10 divide-y divide-border">
        {FAQ.map((item) => (
          <details key={item.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold">
              {item.q}
              <ChevronDown className="size-4 shrink-0 text-foreground/50 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-foreground/65">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
