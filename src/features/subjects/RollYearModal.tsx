"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { invalidateTeacherClasses } from "@/shared/lib/teacherClasses";
import { rollYear, type ClassRow } from "./api";

/**
 * Start a subject over for next year.
 *
 * The dialog says what is left behind before it runs, using the list the
 * database function itself returns — students, attendance, marks,
 * submissions and the timetable. A teacher who expects the roll to come
 * with it would otherwise find an empty register in September.
 */
export default function RollYearModal({ cls, onClose, onDone }: { cls: ClassRow; onClose: () => void; onDone: () => void }) {
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
