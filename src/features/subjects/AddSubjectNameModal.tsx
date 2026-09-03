"use client";

// A subject on its own, with no class yet — the quick way in when a
// teacher just wants "Robotics" to exist so it shows up in every subject
// picker in the studio. Teaching it to a division is a separate, later
// act (the "Add a class" flow, or "Add a subject here" on class
// settings); nothing here creates a roll.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClasses } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { createSubject } from "./api";

export default function AddSubjectNameModal({
  onClose, onDone,
}: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await createSubject(trimmed);
      flash(`${trimmed} added. Teach it to a division from "Your divisions" when you're ready.`);
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || "Could not add that subject.", "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a subject"
      footer={
        <Button onClick={save} disabled={!name.trim() || busy}>
          {busy ? "Adding…" : "Add subject"}
        </Button>
      }
    >
      <Field label="Subject name" required>
        <input
          className={inputClasses}
          value={name}
          autoFocus
          placeholder="Robotics"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </Field>
      <p className="mt-2 text-xs text-muted">
        It joins the built-in list everywhere you pick a subject.
      </p>
    </Modal>
  );
}
