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

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, CalendarPlus, Layers, Paperclip, Pencil, Plus,
  Trash2, UserPlus, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandLoader from "@/components/BrandLoader";
import { flash } from "@/shared/lib/flash";
import { invalidateTeacherClasses } from "@/shared/lib/teacherClasses";
import {
  archiveClass, archiveDivision, archiveSubject, listClasses, listDivisions, listSubjects,
  type ClassRow, type Division, type Subject,
} from "./api";
import AddSubjectModal from "./AddSubjectModal";
import AddSubjectNameModal from "./AddSubjectNameModal";
import AddDivisionModal from "./AddDivisionModal";
import AddStudentsModal from "./AddStudentsModal";
import EditSubjectModal from "./EditSubjectModal";
import TeachModal from "./TeachModal";
import RollModal from "./RollModal";
import RollYearModal from "./RollYearModal";
import ClassDocumentsModal from "./ClassDocumentsModal";

const divisionLabel = (d: Division) => `${d.grade}${d.division ? ` ${d.division}` : ""}`;

export default function SubjectsView() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [ready, setReady] = useState(false);

  const [addSubject, setAddSubject] = useState(false);
  const [addSubjectName, setAddSubjectName] = useState(false);
  const [addDivision, setAddDivision] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [editDivision, setEditDivision] = useState<Division | null>(null);
  const [teachOn, setTeachOn] = useState<Division | null>(null);
  const [rollOn, setRollOn] = useState<Division | null>(null);
  const [addStudentsOn, setAddStudentsOn] = useState<Division | null>(null);
  const [yearOn, setYearOn] = useState<ClassRow | null>(null);
  const [docsOn, setDocsOn] = useState<ClassRow | null>(null);

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
          <div className="flex items-center gap-2">
            {/* Naming a subject with nowhere to teach it yet is a real,
                smaller act than "Add a class" — a teacher who just wants
                Robotics on the list should not be made to pick a
                division to get it. */}
            <Button variant="secondary" onClick={() => setAddSubjectName(true)}>
              <Plus size={15} aria-hidden="true" /> Add subject
            </Button>
            <Button onClick={() => setAddSubject(true)}>
              <Plus size={15} aria-hidden="true" /> Add a class
            </Button>
          </div>
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
                aria-label={`Edit ${s.name}`}
                title="Rename"
                className="text-muted transition-colors hover:text-accent"
                onClick={() => setEditSubject(s)}
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Delete ${s.name}`}
                title="Delete"
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
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Add students to ${divisionLabel(d)}`}
                      title="Add students"
                      onClick={() => setAddStudentsOn(d)}
                      className="rounded-full p-1.5 text-muted transition-colors hover:text-accent"
                    >
                      <UserPlus size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRollOn(d)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-accent hover:text-accent"
                    >
                      <Users size={13} aria-hidden="true" />
                      {d.students} {d.students === 1 ? "student" : "students"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${divisionLabel(d)}`}
                      title="Rename"
                      onClick={() => setEditDivision(d)}
                      className="rounded-full p-1.5 text-muted transition-colors hover:text-accent"
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${divisionLabel(d)}`}
                      title="Delete"
                      onClick={async () => {
                        await archiveDivision(d.id);
                        flash(`${divisionLabel(d)} removed. Its students keep their history.`);
                        load();
                      }}
                      className="rounded-full p-1.5 text-muted transition-colors hover:text-crit"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
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
                        aria-label={`Manage documents for ${c.subject}`}
                        title="Required documents"
                        onClick={() => setDocsOn(c)}
                        className="opacity-70 transition-opacity hover:opacity-100"
                      >
                        <Paperclip size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Start ${c.subject} again next year`}
                        title="Start again next year"
                        onClick={() => setYearOn(c)}
                        className="opacity-70 transition-opacity hover:opacity-100"
                      >
                        <CalendarPlus size={12} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Stop teaching ${c.subject} to ${divisionLabel(d)}`}
                        title="Stop teaching this subject here"
                        onClick={async () => {
                          await archiveClass(c.id);
                          invalidateTeacherClasses();
                          flash(`${c.subject} removed from ${divisionLabel(d)}.`);
                          load();
                        }}
                        className="opacity-70 transition-opacity hover:opacity-100 hover:text-crit"
                      >
                        <X size={12} aria-hidden="true" />
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
      {addSubject && <AddSubjectModal subjects={subjects} divisions={divisions} onClose={() => setAddSubject(false)} onDone={load} />}
      {addSubjectName && <AddSubjectNameModal onClose={() => setAddSubjectName(false)} onDone={load} />}
      {addDivision && <AddDivisionModal onClose={() => setAddDivision(false)} onDone={load} />}
      {editSubject && <EditSubjectModal subject={editSubject} onClose={() => setEditSubject(null)} onDone={load} />}
      {editDivision && <AddDivisionModal division={editDivision} onClose={() => setEditDivision(null)} onDone={load} />}
      {teachOn && <TeachModal division={teachOn} subjects={subjects} onClose={() => setTeachOn(null)} onDone={load} />}
      {rollOn && <RollModal division={rollOn} onClose={() => setRollOn(null)} onDone={load} />}
      {addStudentsOn && <AddStudentsModal division={addStudentsOn} onClose={() => setAddStudentsOn(null)} onDone={load} />}
      {yearOn && <RollYearModal cls={yearOn} onClose={() => setYearOn(null)} onDone={load} />}
      {docsOn && <ClassDocumentsModal cls={docsOn} onClose={() => setDocsOn(null)} />}
    </div>
  );
}
