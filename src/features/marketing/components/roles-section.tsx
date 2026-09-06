import Image from "next/image";
import { GraduationCap, Building2, ShieldCheck, Users } from "lucide-react";

const TEACHER_PHOTO =
  "https://images.unsplash.com/photo-1758685848174-e061c6486651?fm=jpg&q=80&w=1000&auto=format&fit=crop&ixlib=rb-4.1.0";

const ROLES = [
  {
    icon: GraduationCap,
    title: "Teacher",
    body: "The primary user. Build classes, plan a term in one pass, and teach from what's already scheduled.",
  },
  {
    icon: Building2,
    title: "Organisation",
    body: "Verify your own teachers' applications, provide identity proof to the platform, and see the whole institution in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Admin",
    body: "A super admin oversees the whole platform; a sub admin approves teachers within a delegated scope of organisations.",
  },
  {
    icon: Users,
    title: "Student",
    body: "Invite-only, no self-registration. Sees their own classes, calendar, notes, doubts, quizzes, results, and attendance.",
  },
];

export function RolesSection() {
  return (
    <section id="roles" className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-black tracking-tight md:text-4xl">
          Built for the whole institution.
        </h2>
        <p className="mt-3 text-lg text-foreground/65">
          Four roles, one approval chain — nobody gets in without being
          verified by someone above them.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-5">
        <div className="relative hidden min-h-[420px] overflow-hidden rounded-3xl lg:col-span-2 lg:block">
          <Image
            src={TEACHER_PHOTO}
            alt="A teacher working on a laptop in a classroom"
            fill
            sizes="(min-width: 1024px) 40vw, 0vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/0 to-transparent" />
          <p className="absolute inset-x-6 bottom-6 text-xl font-bold text-primary-foreground">
            One approval chain, from teacher to platform.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-3">
          {ROLES.map((role) => (
            <div key={role.title} className="rounded-3xl border border-border bg-card p-7">
              <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <role.icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-bold">{role.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/65">{role.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
