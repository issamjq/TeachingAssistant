"use client";

// =====================================================================
// Subjects and divisions — §105
//
// The screen that answers the three things the studio could not do.
//
//   1. NAME A SUBJECT. `subject` was always free text in the database;
//      the nineteen-item ceiling was MAJORS in src/lib/enums.js feeding
//      every dropdown. A teacher who teaches Robotics filed it under
//      something else. Now the list is the built-ins plus their own.
//
//   2. KEEP A ROLL ONCE. `classes` means (subject × grade × division)
//      and `class_members` hung off it, so a child had to be enrolled
//      per subject. The roll moved to the DIVISION: add a child to 9-A
//      once and every subject taught to 9-A has them. That is the whole
//      feature, and it is why this screen leads with divisions rather
//      than with subjects.
//
//   3. START A SUBJECT OVER. roll_class_year() has been in the database
//      since §102 and had no way to be called. The button here is the
//      first caller it has ever had.
//
// What this screen deliberately does NOT do is take anything away. The
// legacy per-class enrolment still resolves through class_roster(), so
// every existing class shows the roll it showed yesterday.
// =====================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarPlus, Layers, Plus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClasses } from "@/views/_shared";
import BrandLoader from "@/components/BrandLoader";
import { flash } from "@/shared/lib/flash";
import { invalidateTeacherClasses } from "@/shared/lib/teacherClasses";
import {
  archiveSubject, createDivision, createSubject,
  divisionRoll, listClasses, listDivisions, listSubjects, removeFromDivision,
  rollYear, teachSubject,
  type ClassRow, type Division, type RollEntry, type Subject,
} from "./api";

const fullName = (r: { first_name?: string | null; last_name?: string | null; student_code?: string | null }) =>
  [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.student_code || "Unnamed student";

const divisionLabel = (d: Division) => `${d.grade}${d.division ? ` ${d.division}` : ""}`;

export default function SubjectsView() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [ready, setReady] = useState(false);

  const [addSubject, setAddSubject] = useState(false);
  const [addDivision, setAddDivision] = useState(false);
  const [teachOn, setTeachOn] = useState<Division | null>(null);
  const [rollOn, setRollOn] = useState<Division | null>(null);
  const [yearOn, setYearOn] = useState<ClassRow | null>(null);

  // Bumped by every child that writes, which re-runs the load below.
  // A counter rather than calling a loader function from the effect:
  // state must not be set synchronously inside one, and the `live` guard
  // is what stops a resolved fetch writing into an unmounted screen.
  const [reloadAt, setReloadAt] = useState(0);
  const load = useCallback(() => setReloadAt((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    Promise.all([
      listSubjects().catch(() => [] as Subject[]),
      listDivisions().catch(() => [] as Division[]),
      listClasses().catch(() => [] as ClassRow[]),
    ]).then(([s, d, c]) => {
      if (!live) return;
      setSubjects(s); setDivisions(d); setClasses(c); setReady(true);
    });
    return () => { live = false; };
  }, [reloadAt]);

  /** Live classes, filed under the division they are taught to. */
  const byDivision = useMemo(() => {
    const m = new Map<string, ClassRow[]>();
    for (const c of classes) {
      if (c.is_archived || !c.division_id) continue;
      const list = m.get(c.division_id) || [];
      list.push(c);
      m.set(c.division_id, list);
    }
    return m;
  }, [classes]);

  const mine = subjects.filter((s) => s.custom);

  if (!ready) return <BrandLoader />;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 space-y-10">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl text-ink">Subjects and divisions</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          A division is a group of students. Every subject you teach it shares
          the same roll, so a student is added once, not once per subject.
        </p>
      </header>

      {/* ── Subjects ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
            <BookOpen size={17} className="text-accent" aria-hidden="true" />
            Your subjects
          </h2>
          <Button onClick={() => setAddSubject(true)}>
            <Plus size={15} aria-hidden="true" /> Add a subject
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {mine.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink"
            >
              {s.name}
              <button
                type="button"
                aria-label={`Remove ${s.name}`}
                className="text-muted transition-colors hover:text-crit"
                onClick={async () => {
                  await archiveSubject(s.id);
                  flash(`${s.name} removed. Work already filed under it keeps its label.`);
                  load();
                }}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
          {!mine.length && (
            <p className="text-sm text-muted">
              You have not added any of your own yet. The {subjects.length - mine.length} built-in
              subjects are available everywhere already.
            </p>
          )}
        </div>
      </section>

      {/* ── Divisions ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
            <Layers size={17} className="text-accent" aria-hidden="true" />
            Your divisions
          </h2>
          <Button variant="secondary" onClick={() => setAddDivision(true)}>
            <Plus size={15} aria-hidden="true" /> Add a division
          </Button>
        </div>

        {!divisions.length && (
          <p className="rounded-lg border border-line bg-surface p-5 text-sm text-muted">
            No divisions yet. Add one — Grade 9, division A — then teach subjects to it.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {divisions.map((d) => {
            const taught = byDivision.get(d.id) || [];
            return (
              <article key={d.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-lg text-ink">{divisionLabel(d)}</h3>
                    <p className="text-xs text-muted">{d.academic_year}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRollOn(d)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
                  >
                    <Users size={13} aria-hidden="true" />
                    {d.students} {d.students === 1 ? "student" : "students"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {taught.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-xs text-accent"
                    >
                      {c.subject}
                      <button
                        type="button"
                        aria-label={`Start ${c.subject} again next year`}
                        title="Start again next year"
                        onClick={() => setYearOn(c)}
                        className="opacity-70 transition-opacity hover:opacity-100"
                      >
                        <CalendarPlus size={12} aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {!taught.length && <span className="text-xs text-muted">No subjects yet.</span>}
                  <button
                    type="button"
                    onClick={() => setTeachOn(d)}
                    className="rounded-md border border-dashed border-line px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    + Teach a subject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Mounted only while open, so each one starts with clean fields.
          Resetting them in an effect instead is what
          react-hooks/set-state-in-effect is there to catch. */}
      {addSubject && <AddSubjectModal onClose={() => setAddSubject(false)} onDone={load} />}
      {addDivision && <AddDivisionModal onClose={() => setAddDivision(false)} onDone={load} />}
      {teachOn && <TeachModal division={teachOn} subjects={subjects} onClose={() => setTeachOn(null)} onDone={load} />}
      {rollOn && <RollModal division={rollOn} onClose={() => setRollOn(null)} onDone={load} />}
      {yearOn && <RollYearModal cls={yearOn} onClose={() => setYearOn(null)} onDone={load} />}
    </div>
  );
}


function AddSubjectModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await createSubject(name.trim());
      flash(`${name.trim()} added.`);
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || "Could not add that subject.", "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Add a subject"
      footer={<Button onClick={save} disabled={!name.trim() || busy}>{busy ? "Adding…" : "Add subject"}</Button>}>
      <Field label="Subject name" required>
        <input className={inputClasses} value={name} autoFocus
          placeholder="Robotics"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()} />
      </Field>
      <p className="mt-2 text-xs text-muted">
        It joins the built-in list everywhere you pick a subject.
      </p>
    </Modal>
  );
}


function AddDivisionModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [grade, setGrade] = useState("");
  const [division, setDivision] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!grade.trim() || busy) return;
    setBusy(true);
    try {
      await createDivision(grade.trim(), division.trim());
      flash("Division added.");
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || "Could not add that division.", "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Add a division"
      footer={<Button onClick={save} disabled={!grade.trim() || busy}>{busy ? "Adding…" : "Add division"}</Button>}>
      <Field label="Grade" required>
        <input className={inputClasses} value={grade} autoFocus placeholder="Grade 9"
          onChange={(e) => setGrade(e.target.value)} />
      </Field>
      <Field label="Division" hint="Leave blank if the grade is not split.">
        <input className={inputClasses} value={division} placeholder="A"
          onChange={(e) => setDivision(e.target.value)} />
      </Field>
    </Modal>
  );
}


function TeachModal({
  division, subjects, onClose, onDone,
}: { division: Division; subjects: Subject[]; onClose: () => void; onDone: () => void }) {
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!division || !pick || busy) return;
    setBusy(true);
    try {
      await teachSubject(pick, division.id);
      invalidateTeacherClasses();
      flash(`${pick} now reaches all ${division.students} student(s) in ${divisionLabel(division)}.`);
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || "Could not add that subject.", "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}
      title={division ? `Teach a subject to ${divisionLabel(division)}` : ""}
      footer={<Button onClick={save} disabled={!pick || busy}>{busy ? "Adding…" : "Teach it"}</Button>}>
      <Field label="Subject" required>
        <select className={inputClasses} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Choose a subject…</option>
          {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </Field>
      {division && (
        <p className="mt-2 text-xs text-muted">
          It picks up this division&apos;s roll immediately. There is nobody to enrol.
        </p>
      )}
    </Modal>
  );
}


/** The roll itself. This is the list every subject on the division shares. */
function RollModal({ division, onClose, onDone }: { division: Division; onClose: () => void; onDone: () => void }) {
  const [roll, setRoll] = useState<RollEntry[] | null>(null);

  useEffect(() => {
    let live = true;
    divisionRoll(division.id)
      .then((r) => { if (live) setRoll(r); })
      .catch(() => { if (live) setRoll([]); });
    return () => { live = false; };
  }, [division.id]);

  return (
    <Modal open onClose={onClose}
      title={division ? `${divisionLabel(division)} — the roll` : ""}>
      {roll === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !roll.length ? (
        <p className="text-sm text-muted">
          Nobody in this division yet. Students added here appear in every subject you teach it.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {roll.map((r) => (
            <li key={r.member_id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-ink">{fullName(r)}</span>
              <button
                type="button"
                className="text-xs text-muted transition-colors hover:text-crit"
                onClick={async () => {
                  if (!division) return;
                  await removeFromDivision(division.id, r.id);
                  setRoll((cur) => (cur || []).filter((x) => x.id !== r.id));
                  onDone();
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">
        Removing a student here removes them from every subject taught to this division.
      </p>
    </Modal>
  );
}


/**
 * Start a subject over for next year.
 *
 * The dialog says what is left behind before it runs, using the list the
 * database function itself returns — students, attendance, marks,
 * submissions and the timetable. A teacher who expects the roll to come
 * with it would otherwise find an empty register in September.
 */
function RollYearModal({ cls, onClose, onDone }: { cls: ClassRow; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!cls || busy) return;
    setBusy(true);
    try {
      const r = await rollYear(cls.id, { goals: true, archive: false });
      flash(
        `${cls.subject} started again for ${r.academic_year}: ${r.carried_work} item(s) and ${r.carried_goals} goal(s) carried over.`
      );
      invalidateTeacherClasses();
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || "Could not start that year.", "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose}
      title={cls ? `Start ${cls.subject} again next year` : ""}
      footer={<Button onClick={run} disabled={busy}>{busy ? "Starting…" : "Start next year"}</Button>}>
      {cls && (
        <div className="space-y-3 text-sm text-ink-soft">
          <p>
            Makes a fresh {cls.subject} for {cls.grade}
            {cls.division ? ` ${cls.division}` : ""} in the next academic year and copies
            your lesson plans, decks, quizzes and goals into it.
          </p>
          <p className="rounded-lg border border-line bg-paper-warm p-3 text-xs">
            <strong className="text-ink">Not carried over:</strong> students, attendance,
            marks, submissions and the timetable. A new year is new children.
          </p>
          <p className="text-xs text-muted">
            Running it twice lands on the same year rather than making a second copy.
          </p>
        </div>
      )}
    </Modal>
  );
}
