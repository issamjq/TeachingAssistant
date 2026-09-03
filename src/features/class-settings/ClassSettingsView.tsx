"use client";

// =====================================================================
// One class's control panel — §105
//
// Everything on this screen belongs to ONE subject at ONE grade, which
// is the whole reason it can exist. There is no such thing as
// settings-in-general here: a roll, a curriculum, a set of uploads and a
// rollover all belong to a particular class, so a top-level Settings tab
// would have had to ask which class before it could show anything. It is
// reached from the class itself in the rail, beside its lessons and its
// quizzes, and reads the same class scope every library screen reads.
//
// ── The hierarchy, decided before the markup ────────────────────────
//
// A teacher opens this to answer ONE question: who is in this class. So
// the roll is the middle of the page at full contrast, served by one
// accented action — Add students. Everything else is quieter on purpose:
//
//   · Curriculum and Material are NAVIGATION, not settings. They are
//     quiet links, not cards competing with the roll.
//   · Next year is rare and consequential, so it sits apart at the
//     bottom in its own block. In the first cut it was a peer of "Add
//     students", which made a once-a-year act look routine.
//
// One accent on the page. If three things are firozeh, firozeh means
// nothing.
// =====================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookMarked, CalendarPlus, FileText, TriangleAlert, UserMinus, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, inputClasses } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { navigate } from "@/lib/route";
import { classScopeLabel, useClassScope } from "@/shared/lib/classScope";
import { normGrade, normSubject } from "@/shared/lib/classMatch";
import { invalidateTeacherClasses } from "@/shared/lib/teacherClasses";
import {
  classRoster, listClasses, listDivisions,
  rollYear, setClassException,
  AddStudentsModal, AddSubjectToDivisionsModal,
  type ClassRow, type Division, type RollEntry,
} from "@/features/subjects";

type Student = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  student_code: string | null;
  grade: string | null;
  division: string | null;
};

const fullName = (r: Partial<Student> & { student_code?: string | null }) =>
  [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.student_code || "Unnamed student";

const divisionName = (c: ClassRow) => (c.division ? `Division ${c.division}` : "Whole grade");

export default function ClassSettingsView() {
  const scope = useClassScope();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [roster, setRoster] = useState<Record<string, RollEntry[]> | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadAt, setReloadAt] = useState(0);
  const reload = useCallback(() => setReloadAt((n) => n + 1), []);

  const [addOn, setAddOn] = useState<Division | null>(null);
  const [yearOpen, setYearOpen] = useState(false);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([listClasses(), listDivisions()])
      .then(([c, d]) => {
        if (!live) return;
        setClasses(c); setDivisions(d); setError(null); setReady(true);
      })
      .catch((e: Error) => {
        if (!live) return;
        setError(e?.message || "Could not load this class."); setReady(true);
      });
    return () => { live = false; };
  }, [reloadAt]);

  /** The class rows for the scoped subject+grade — one per division. */
  const mine = useMemo(() => {
    if (!scope) return [];
    return classes.filter(
      (c) =>
        !c.is_archived &&
        normSubject(c.subject) === normSubject(scope.subject) &&
        normGrade(c.grade) === normGrade(scope.grade)
    );
  }, [classes, scope]);

  /**
   * The actual division rows behind `mine` — what "Add a subject here"
   * teaches a new subject to. Read off `mine` rather than filtered
   * separately from `divisions`, so it can never name a division this
   * class does not actually reach.
   */
  const myDivisions = useMemo(() => {
    const ids = new Set(mine.map((c) => c.division_id).filter(Boolean));
    return divisions.filter((d) => ids.has(d.id));
  }, [mine, divisions]);

  // The resolved roll of each: the division, plus this subject's own
  // additions, minus its own removals. Loaded per class rather than read
  // off the division, because those exceptions are exactly the difference.
  useEffect(() => {
    let live = true;
    // No early return for the empty case: Promise.all([]) already
    // resolves to {}, and short-circuiting with a synchronous setRoster
    // here is the cascading-render pattern the lint rule exists to stop.
    Promise.all(
      mine.map((c) => classRoster(c.id).then((r) => [c.id, r] as const).catch(() => [c.id, []] as const))
    ).then((pairs) => { if (live) setRoster(Object.fromEntries(pairs)); });
    return () => { live = false; };
  }, [mine]);

  const total = useMemo(
    () => Object.values(roster || {}).reduce((n, r) => n + r.length, 0),
    [roster]
  );

  if (!scope) return <PickAClass />;
  if (!ready) return <Skeleton />;
  if (error) return <LoadError message={error} onRetry={reload} />;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      {/* ── Header. The class, named once, at display size. ───────── */}
      <header className="mb-12">
        <h1 className="font-serif text-[clamp(28px,3.4vw,38px)] leading-[1.1] tracking-[-0.012em] text-ink">
          {classScopeLabel(scope)}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {roster === null
            ? "Counting the roll…"
            : mine.length === 0
              ? "Not set up as a class yet."
              : `${total} ${total === 1 ? "student" : "students"} across ${mine.length} ${mine.length === 1 ? "division" : "divisions"}.`}
        </p>
      </header>

      {/* ── THE ROLL. The reason the screen exists. ───────────────── */}
      {mine.length === 0 ? (
        <NoDivision />
      ) : (
        <section className="space-y-8">
          {mine.map((c) => {
            const div = divisions.find((d) => d.id === c.division_id) || null;
            const roll = roster?.[c.id];
            return (
              <article key={c.id}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <h2 className="font-serif text-xl leading-tight text-ink">{divisionName(c)}</h2>
                    {div && (
                      <p className="mt-0.5 text-[13px] text-muted">
                        Shared with every subject you teach {c.grade}
                        {c.division ? ` ${c.division}` : ""}
                      </p>
                    )}
                  </div>
                  {div && (
                    <Button onClick={() => setAddOn(div)}>
                      <UserPlus size={15} aria-hidden="true" /> Add students
                    </Button>
                  )}
                </div>

                <div className="overflow-hidden rounded-xl border border-line bg-surface">
                  {roll === undefined ? (
                    <RollSkeleton />
                  ) : roll.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-muted">
                      Nobody yet. Students added to this division appear in every
                      subject you teach it.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line-soft">
                      {roll.map((r) => (
                        <li key={r.id} className="group flex items-center gap-3 px-5">
                          <span className="min-w-0 flex-1 truncate py-3 text-[15px] text-ink">
                            {fullName(r)}
                          </span>
                          {/* Always rendered, never display:none — a keyboard
                              user must be able to reach it. It fades in on
                              hover and is forced visible on focus. */}
                          <button
                            type="button"
                            title={`Remove ${fullName(r)} from ${c.subject} only`}
                            className="-mr-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted opacity-0 transition-opacity duration-150 hover:text-crit focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent group-hover:opacity-100"
                            onClick={async () => {
                              try {
                                await setClassException(c.id, r.id, "exclude");
                                setRoster((cur) => ({
                                  ...(cur || {}),
                                  [c.id]: (cur?.[c.id] || []).filter((x) => x.id !== r.id),
                                }));
                                flash(`${fullName(r)} removed from ${c.subject} only.`);
                              } catch (e) {
                                flash((e as Error).message || "Could not remove them.", "error");
                              }
                            }}
                          >
                            <UserMinus size={14} aria-hidden="true" />
                            This subject only
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* ── Navigation, deliberately quiet. Not settings. ─────────── */}
      <nav className="mt-12 flex flex-wrap gap-x-8 gap-y-2 border-t border-line-soft pt-6">
        <QuietLink
          icon={BookMarked}
          label="Curriculum"
          hint="units and pacing"
          // A standalone page now, not a detour through "+ New goal" —
          // browsing the unit sequence and starting a goal from one are
          // different acts, and this link is for the first.
          onClick={() => navigate(["curriculum"])}
        />
        <QuietLink icon={FileText} label="Material" hint="uploads filed here" onClick={() => navigate(["materials"])} />
        {myDivisions.length > 0 && (
          <QuietLink
            label="Add a subject here"
            hint={`reaches the same roll as ${scope.subject}`}
            onClick={() => setAddSubjectOpen(true)}
          />
        )}
        <QuietLink label="Add a subject or division" onClick={() => navigate(["subjects"])} />
      </nav>

      {/* ── Rare and consequential, so set apart. ─────────────────── */}
      {mine.length > 0 && (
        <section className="mt-8 rounded-xl border border-line bg-paper-warm p-5">
          <h2 className="font-serif text-lg text-ink">Next year</h2>
          <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-ink-soft">
            Start {scope.subject} again for next year&apos;s children. Your lesson plans,
            decks, quizzes and goals are copied across. Students, attendance, marks and
            the timetable are not.
          </p>
          <div className="mt-4">
            <Button variant="outline" onClick={() => setYearOpen(true)}>
              <CalendarPlus size={15} aria-hidden="true" /> Start next year
            </Button>
          </div>
        </section>
      )}

      {addOn && <AddStudentsModal division={addOn} onClose={() => setAddOn(null)} onDone={reload} />}
      {addSubjectOpen && (
        <AddSubjectToDivisionsModal divisions={myDivisions}
          onClose={() => setAddSubjectOpen(false)} onDone={reload} />
      )}
      {yearOpen && (
        <NextYearModal subject={scope.subject} classes={mine}
          onClose={() => setYearOpen(false)} onDone={reload} />
      )}
    </div>
  );
}


/* ── Small parts ───────────────────────────────────────────────── */

function QuietLink({
  icon: Icon, label, hint, onClick,
}: { icon?: React.ElementType; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-md text-[14px] text-ink-soft transition-colors duration-150 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {Icon && <Icon size={15} className="text-muted" aria-hidden="true" />}
      <span className="underline decoration-line-strong underline-offset-4">{label}</span>
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
    </button>
  );
}

/** Skeletons match the eventual layout, so nothing jumps when data lands. */
function Skeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl animate-pulse px-6 py-10" aria-hidden="true">
      <div className="mb-12">
        <div className="h-9 w-72 max-w-full rounded bg-line-soft" />
        <div className="mt-3 h-4 w-52 max-w-full rounded bg-line-soft" />
      </div>
      <div className="mb-3 h-6 w-40 rounded bg-line-soft" />
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <RollSkeleton />
      </div>
    </div>
  );
}

function RollSkeleton() {
  return (
    <ul className="divide-y divide-line-soft" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="px-5 py-3.5">
          <div className="h-4 rounded bg-line-soft" style={{ width: `${52 - i * 8}%` }} />
        </li>
      ))}
    </ul>
  );
}

function PickAClass() {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-24 text-center">
      <h1 className="font-serif text-2xl text-ink">Pick a class first</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        These settings belong to one subject at one grade. Choose a class in the
        sidebar and its settings open here.
      </p>
    </div>
  );
}

function NoDivision() {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <h2 className="font-serif text-lg text-ink">No division yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
        A division is the group of students a roll belongs to. This class works
        without one — its lessons, quizzes and material are all fine — but there
        is nobody to enrol until it has one.
      </p>
      <div className="mt-5">
        <Button onClick={() => navigate(["subjects"])}>Add a division</Button>
      </div>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-24 text-center">
      <TriangleAlert size={20} className="mx-auto text-crit" aria-hidden="true" />
      <h1 className="mt-3 font-serif text-xl text-ink">This class did not load</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">{message}</p>
      <div className="mt-5">
        <Button variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}


/**
 * Roll the whole subject forward, not one division at a time.
 *
 * A teacher thinks "start Physics again", not "start Physics 9-A, then
 * Physics 9-B". Each division is its own class row underneath, so this
 * runs roll_class_year() once per row and reports the total.
 */
function NextYearModal({
  subject, classes, onClose, onDone,
}: { subject: string; classes: ClassRow[]; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const results = await Promise.all(classes.map((c) => rollYear(c.id, { goals: true, archive: false })));
      const work = results.reduce((n, r) => n + (r.carried_work || 0), 0);
      const goals = results.reduce((n, r) => n + (r.carried_goals || 0), 0);
      invalidateTeacherClasses();
      flash(`${subject} started again for ${results[0]?.academic_year}: ${work} item${work === 1 ? "" : "s"} and ${goals} goal${goals === 1 ? "" : "s"} carried.`);
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || "Could not start that year.", "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Start ${subject} again next year`}
      footer={<Button onClick={run} disabled={busy}>{busy ? "Starting…" : "Start next year"}</Button>}
    >
      <div className="space-y-4 text-[15px] leading-relaxed text-ink-soft">
        <p>
          Makes a fresh {subject} for next year across{" "}
          {classes.length === 1 ? "this division" : `all ${classes.length} divisions`}, and
          copies your lesson plans, decks, quizzes and goals into it.
        </p>
        <div className="rounded-lg border border-line bg-paper-warm px-3 py-2.5">
          <p className="text-[13px] leading-relaxed">
            <strong className="font-semibold text-ink">Not carried over:</strong> students,
            attendance, marks, submissions and the timetable. A new year is new children.
          </p>
        </div>
        <p className="text-[13px] text-muted">
          Safe to run twice — it lands on the same year rather than making a second copy.
        </p>
      </div>
    </Modal>
  );
}
