"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClasses } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { updateSubject, type Subject } from "./api";

export default function EditSubjectModal({
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
