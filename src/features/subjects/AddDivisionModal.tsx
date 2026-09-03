"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClasses } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { createDivision, updateDivision, type Division } from "./api";

/** Add a division, or — with `division` passed — rename the one given. */
export default function AddDivisionModal({
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
