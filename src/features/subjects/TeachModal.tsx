"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClasses } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { invalidateTeacherClasses } from "@/shared/lib/teacherClasses";
import { teachSubject, type Division, type Subject } from "./api";

const divisionLabel = (d: Division) => `${d.grade}${d.division ? ` ${d.division}` : ""}`;

export default function TeachModal({
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
