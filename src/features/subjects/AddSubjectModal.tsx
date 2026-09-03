"use client";

// ONE ACT: name the subject and say which class or classes it is for.
//
// It used to be two — add a subject, then find its division and teach it
// — which left a teacher holding a subject that taught nobody and no
// obvious way to finish. A subject with no class is not a thing anyone
// wanted; it is half of one.
//
// "Which class" is now a picklist, not a single grade+division pair: a
// teacher who teaches Physics to three Grade 9 divisions at once should
// not run this dialog three times. Every division checked — existing or
// freshly typed — gets its own class, all from one Subject box and one
// save.
//
// The subject box accepts an existing name or a new one. Whichever it
// is, this creates only what is missing: the subject if it is new, each
// division that is new, and the class that joins the subject to it.
// Files picked under "Required documents" are attached to every class
// this save creates.

import React, { useMemo, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClasses } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { invalidateTeacherClasses } from "@/shared/lib/teacherClasses";
import {
  createClassDocument, createDivision, createSubject, teachSubject,
  type ClassRow, type Division, type Subject,
} from "./api";
import { uploadClassDocument } from "./uploadClassDocument";

/**
 * Same header/hint markup as `Field`, wrapped in a `<div>` instead of a
 * `<label>`. Field's outer `<label>` is fine around a single input — it
 * is how "Subject" works here — but a section with several checkboxes
 * and buttons inside it must not sit inside a `<label>`: a click
 * anywhere in the block would delegate to whichever control the
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

export default function AddSubjectModal({
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
