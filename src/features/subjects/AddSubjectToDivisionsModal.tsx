"use client";

// Add a subject FROM inside one class's settings, reaching the same
// divisions that class already does.
//
// class-settings knows exactly which divisions it is — that is the
// point of the screen — so unlike the general "Add a class" flow on
// /subjects, there is nothing to pick here. Naming a new subject is the
// whole act, and it is taught to every one of them in the same breath.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClasses } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { invalidateTeacherClasses } from "@/shared/lib/teacherClasses";
import { createSubject, teachSubject, type Division } from "./api";

const divisionLabel = (d: Division) => `${d.grade}${d.division ? ` ${d.division}` : ""}`;

export default function AddSubjectToDivisionsModal({
  divisions, onClose, onDone,
}: { divisions: Division[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const label = divisions.length === 1
    ? divisionLabel(divisions[0])
    : `${divisions.length} divisions`;

  const save = async () => {
    const subject = name.trim();
    if (!subject || busy || !divisions.length) return;
    setBusy(true);
    try {
      // Only what is missing — createSubject is skipped for a built-in
      // or one already named; a duplicate-name error here is not
      // something to show for an act that is otherwise going to
      // succeed, so it is swallowed rather than aborting the teach.
      try {
        await createSubject(subject);
      } catch (e) {
        if (!/already have a subject/i.test((e as Error).message || "")) throw e;
      }
      for (const d of divisions) await teachSubject(subject, d.id);
      invalidateTeacherClasses();
      flash(`${subject} added to ${label} — it picked up the same roll straight away.`);
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || "Could not add that subject.", "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a subject here"
      footer={
        <Button onClick={save} disabled={!name.trim() || busy || !divisions.length}>
          {busy ? "Adding…" : "Add subject"}
        </Button>
      }
    >
      <Field label="Subject name" required hint={`Reaches ${label}`}>
        <input
          className={inputClasses}
          value={name}
          autoFocus
          placeholder="Chemistry"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </Field>
      <p className="mt-2 text-xs text-muted">
        It picks up the same roll{divisions.length === 1 ? "" : "s"} this class already has —
        there is nobody to enrol twice.
      </p>
    </Modal>
  );
}
