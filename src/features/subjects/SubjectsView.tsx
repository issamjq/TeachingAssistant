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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, CalendarPlus, FileText, Layers, Paperclip, Pencil, Plus,
  Trash2, Upload, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClasses } from "@/views/_shared";
import BrandLoader from "@/components/BrandLoader";
import { flash } from "@/shared/lib/flash";
import { invalidateTeacherClasses } from "@/shared/lib/teacherClasses";
import {
  archiveClass, archiveDivision, archiveSubject, createClassDocument, createDivision, createSubject,
  deleteClassDocument, divisionRoll, listClassDocuments, listClasses, listDivisions, listSubjects,
  removeFromDivision, rollYear, teachSubject, updateDivision, updateSubject,
  type ClassDocument, type ClassRow, type Division, type RollEntry, type Subject,
} from "./api";
import { uploadClassDocument } from "./uploadClassDocument";

const fullName = (r: { first_name?: string | null; last_name?: string | null; student_code?: string | null }) =>
  [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.student_code || "Unnamed student";

const divisionLabel = (d: Division) => `${d.grade}${d.division ? ` ${d.division}` : ""}`;

/**
 * Same header/hint markup as `Field`, wrapped in a `<div>` instead of a
 * `<label>`. Field's outer `<label>` is fine around a single input — it
 * is how "Subject" and "Grade" work today — but a section with several
 * checkboxes and buttons inside it must not sit inside a `<label>`: a
 * click anywhere in the block would delegate to whichever control the
 * browser treats as "the" associated one, double-toggling a checkbox or
 * firing a button its own onClick did not ask for.
 */
function FieldBlock({
  label, hint, required = false, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted flex items-center justify-between gap-3 mb-2">
        <span>
          {label}
          {required && <span className="text-accent ml-1" aria-hidden>*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </span>
        {hint && <span className="normal-case tracking-normal font-serif italic">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

export default function SubjectsView() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [ready, setReady] = useState(false);

  const [addSubject, setAddSubject] = useState(false);
  const [addDivision, setAddDivision] = useState(false);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [editDivision, setEditDivision] = useState<Division | null>(null);
  const [teachOn, setTeachOn] = useState<Division | null>(null);
  const [rollOn, setRollOn] = useState<Division | null>(null);
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
          <Button onClick={() => setAddSubject(true)}>
            <Plus size={15} aria-hidden="true" /> Add a class
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
      {addDivision && <AddDivisionModal onClose={() => setAddDivision(false)} onDone={load} />}
      {editSubject && <EditSubjectModal subject={editSubject} onClose={() => setEditSubject(null)} onDone={load} />}
      {editDivision && <AddDivisionModal division={editDivision} onClose={() => setEditDivision(null)} onDone={load} />}
      {teachOn && <TeachModal division={teachOn} subjects={subjects} onClose={() => setTeachOn(null)} onDone={load} />}
      {rollOn && <RollModal division={rollOn} onClose={() => setRollOn(null)} onDone={load} />}
      {yearOn && <RollYearModal cls={yearOn} onClose={() => setYearOn(null)} onDone={load} />}
      {docsOn && <ClassDocumentsModal cls={docsOn} onClose={() => setDocsOn(null)} />}
    </div>
  );
}


/**
 * ONE ACT: name the subject and say which class or classes it is for.
 *
 * It used to be two — add a subject, then find its division and teach it
 * — which left a teacher holding a subject that taught nobody and no
 * obvious way to finish. A subject with no class is not a thing anyone
 * wanted; it is half of one.
 *
 * "Which class" is now a picklist, not a single grade+division pair: a
 * teacher who teaches Physics to three Grade 9 divisions at once should
 * not run this dialog three times. Every division checked — existing or
 * freshly typed — gets its own class, all from one Subject box and one
 * save.
 *
 * The subject box accepts an existing name or a new one. Whichever it
 * is, this creates only what is missing: the subject if it is new, each
 * division that is new, and the class that joins the subject to it.
 * Files picked under "Required documents" are attached to every class
 * this save creates.
 */
function AddSubjectModal({
  subjects, divisions, onClose, onDone,
}: {
  subjects: Subject[];
  divisions: Division[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  // Existing divisions the teacher checked, by id.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Grade/division pairs typed in that do not exist yet.
  const [pending, setPending] = useState<{ grade: string; division: string }[]>([]);
  const [newGrade, setNewGrade] = useState("");
  const [newDivision, setNewDivision] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Grades she already teaches, so typing a new division under one of
  // them is a pick, not a retype prone to a typo that misses the match.
  const grades = useMemo(
    () => [...new Set(divisions.map((d) => d.grade.trim()).filter(Boolean))].sort(),
    [divisions]
  );
  const byGrade = useMemo(() => {
    const m = new Map<string, Division[]>();
    for (const d of divisions) {
      const list = m.get(d.grade) || [];
      list.push(d);
      m.set(d.grade, list);
    }
    return m;
  }, [divisions]);

  const targetCount = picked.size + pending.length;

  const togglePicked = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const addPending = () => {
    const g = newGrade.trim();
    if (!g) return;
    const div = newDivision.trim();
    const existing = divisions.find(
      (d) => d.grade.trim().toLowerCase() === g.toLowerCase()
        && (d.division || "").trim().toLowerCase() === div.toLowerCase()
    );
    if (existing) {
      setPicked((prev) => new Set(prev).add(existing.id));
    } else if (!pending.some((t) => t.grade.toLowerCase() === g.toLowerCase() && t.division.toLowerCase() === div.toLowerCase())) {
      setPending((prev) => [...prev, { grade: g, division: div }]);
    }
    setNewGrade(""); setNewDivision("");
  };

  const save = async () => {
    const subject = name.trim();
    if (!subject || !targetCount || busy) return;
    setBusy(true);
    try {
      // Only what is missing. createSubject is skipped for a built-in or
      // one she already named; both would fail the unique index anyway,
      // and a duplicate-name error is not something to show for an act
      // that is otherwise going to succeed.
      const known = subjects.some((x) => x.name.trim().toLowerCase() === subject.toLowerCase());
      if (!known) await createSubject(subject);

      const targets: Division[] = [];
      for (const id of picked) {
        const d = divisions.find((x) => x.id === id);
        if (d) targets.push(d);
      }
      for (const t of pending) {
        targets.push(await createDivision(t.grade, t.division));
      }

      const created: ClassRow[] = [];
      for (const t of targets) {
        created.push(await teachSubject(subject, t.id));
      }
      invalidateTeacherClasses();

      if (files.length) {
        for (const cls of created) {
          for (const file of files) {
            const uploaded = await uploadClassDocument(file, cls.id);
            await createClassDocument({
              class_id: cls.id, name: uploaded.name, path: uploaded.path,
              mime_type: uploaded.mime_type, size_bytes: uploaded.size_bytes,
            });
          }
        }
      }

      flash(
        `${subject} added to ${targets.length} class${targets.length === 1 ? "" : "es"}` +
        (files.length ? ` with ${files.length} required document${files.length === 1 ? "" : "s"}.` : ".")
      );
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || "Could not add that class.", "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a class"
      footer={
        <Button onClick={save} disabled={!name.trim() || !targetCount || busy}>
          {busy ? "Adding…" : `Add class${targetCount > 1 ? `es (${targetCount})` : ""}`}
        </Button>
      }
    >
      <Field label="Subject" required>
        <input
          className={inputClasses}
          value={name}
          autoFocus
          list="subject-options"
          placeholder="Physics, or a subject of your own"
          onChange={(e) => setName(e.target.value)}
        />
        <datalist id="subject-options">
          {subjects.map((x) => <option key={x.id} value={x.name} />)}
        </datalist>
      </Field>

      <FieldBlock
        label="Grade and division"
        required
        hint="Check every division this subject is taught to. It can be more than one."
      >
        {divisions.length > 0 && (
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-line p-2">
            {grades.map((g) => (
              <div key={g}>
                <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted">{g}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 py-0.5">
                  {(byGrade.get(g) || []).map((d) => (
                    <label key={d.id} className="flex items-center gap-1.5 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={picked.has(d.id)}
                        onChange={() => togglePicked(d.id)}
                      />
                      {d.division || "Whole grade"}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {pending.map((t, i) => (
            <span key={`${t.grade}-${t.division}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-xs text-accent">
              {t.grade}{t.division ? ` ${t.division}` : ""}
              <button type="button" aria-label={`Remove ${t.grade} ${t.division}`}
                onClick={() => setPending((prev) => prev.filter((_, idx) => idx !== i))}>
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <input
            className={inputClasses}
            value={newGrade}
            list="grade-options"
            placeholder="New grade, e.g. Grade 10"
            onChange={(e) => setNewGrade(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPending())}
          />
          <datalist id="grade-options">
            {grades.map((g) => <option key={g} value={g} />)}
          </datalist>
          <input
            className={inputClasses}
            value={newDivision}
            placeholder="Division (optional)"
            onChange={(e) => setNewDivision(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPending())}
          />
          <Button type="button" variant="secondary" onClick={addPending} disabled={!newGrade.trim()}>
            + Add
          </Button>
        </div>
      </FieldBlock>

      <FieldBlock
        label="Required documents"
        hint="Files a teacher needs for this class — a syllabus, a rubric, a form. Optional, and attached to every class above."
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            setFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
            // Deferred, not synchronous: clearing the input's own value in
            // the same tick as the state update above raced React's commit
            // for it — the file reliably vanished from `files` before the
            // list ever painted. A macrotask puts it safely after.
            setTimeout(() => { if (fileInput.current) fileInput.current.value = ""; }, 0);
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Upload size={13} aria-hidden="true" /> Attach a document
        </button>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md border border-line-soft px-2 py-1 text-xs text-ink-soft">
                <span className="flex items-center gap-1.5 truncate">
                  <FileText size={12} aria-hidden="true" className="shrink-0 text-muted" />
                  <span className="truncate">{f.name}</span>
                </span>
                <button type="button" aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 text-muted hover:text-crit">
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </FieldBlock>

      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        A division already taught this subject picks up its roll straight away —
        there is nobody to enrol twice.
      </p>
    </Modal>
  );
}


function EditSubjectModal({
  subject, onClose, onDone,
}: { subject: Subject; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(subject.name);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await updateSubject(subject.id, trimmed);
      flash(`Renamed to ${trimmed}.`);
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || "Could not rename that subject.", "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="Rename subject"
      footer={<Button onClick={save} disabled={!name.trim() || busy}>{busy ? "Saving…" : "Save"}</Button>}>
      <Field label="Subject name" required>
        <input className={inputClasses} value={name} autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()} />
      </Field>
      <p className="mt-2 text-xs text-muted">
        Work already filed under {subject.name} keeps that label — this only changes the name going forward.
      </p>
    </Modal>
  );
}


/** Add a division, or — with `division` passed — rename the one given. */
function AddDivisionModal({
  division, onClose, onDone,
}: { division?: Division; onClose: () => void; onDone: () => void }) {
  const editing = !!division;
  const [grade, setGrade] = useState(division?.grade ?? "");
  const [div, setDiv] = useState(division?.division ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!grade.trim() || busy) return;
    setBusy(true);
    try {
      if (editing) {
        await updateDivision(division!.id, grade.trim(), div.trim());
        flash("Division updated.");
      } else {
        await createDivision(grade.trim(), div.trim());
        flash("Division added.");
      }
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || `Could not ${editing ? "update" : "add"} that division.`, "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={editing ? "Edit division" : "Add a division"}
      footer={<Button onClick={save} disabled={!grade.trim() || busy}>
        {busy ? "Saving…" : editing ? "Save" : "Add division"}
      </Button>}>
      <Field label="Grade" required>
        <input className={inputClasses} value={grade} autoFocus placeholder="Grade 9"
          onChange={(e) => setGrade(e.target.value)} />
      </Field>
      <Field label="Division" hint="Leave blank if the grade is not split.">
        <input className={inputClasses} value={div} placeholder="A"
          onChange={(e) => setDiv(e.target.value)} />
      </Field>
    </Modal>
  );
}


/** The required documents for one class — attach more, or remove one. */
function ClassDocumentsModal({ cls, onClose }: { cls: ClassRow; onClose: () => void }) {
  const [docs, setDocs] = useState<ClassDocument[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    listClassDocuments(cls.id).then(setDocs).catch(() => setDocs([]));
  }, [cls.id]);

  useEffect(() => { reload(); }, [reload]);

  const addFiles = async (list: FileList | null) => {
    const chosen = Array.from(list || []);
    if (!chosen.length || busy) return;
    setBusy(true);
    try {
      for (const file of chosen) {
        const uploaded = await uploadClassDocument(file, cls.id);
        await createClassDocument({
          class_id: cls.id, name: uploaded.name, path: uploaded.path,
          mime_type: uploaded.mime_type, size_bytes: uploaded.size_bytes,
        });
      }
      reload();
    } catch (e) {
      flash((e as Error).message || "Could not add that document.", "error");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <Modal open onClose={onClose} title={`Required documents — ${cls.subject}`}>
      {docs === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !docs.length ? (
        <p className="text-sm text-muted">
          Nothing attached yet. Add the files this class needs — a syllabus, a rubric, a form.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                <FileText size={14} aria-hidden="true" className="shrink-0 text-muted" />
                <span className="truncate">{doc.name}</span>
              </span>
              <button
                type="button"
                className="shrink-0 text-xs text-muted transition-colors hover:text-crit"
                onClick={async () => {
                  await deleteClassDocument(doc.id);
                  setDocs((cur) => (cur || []).filter((x) => x.id !== doc.id));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        <Upload size={13} aria-hidden="true" /> {busy ? "Adding…" : "Attach a document"}
      </button>
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
