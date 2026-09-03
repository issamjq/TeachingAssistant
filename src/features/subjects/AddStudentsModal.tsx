"use client";

// Add students to the DIVISION, not to a subject.
//
// Worth saying before the list rather than after it: this is not "add
// to Physics", it is "add to 9-A", and every subject taught to 9-A
// picks them up. Shared by class-settings (add to the division a class
// is scoped to) and the /subjects screen itself (add to any division
// from its own card) — one picker, one behaviour, wherever it opens.

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal, inputClasses } from "@/views/_shared";
import { flash } from "@/shared/lib/flash";
import { api } from "@/shared/lib/apiClient";
import { invalidateTeacherClasses } from "@/shared/lib/teacherClasses";
import { addToDivision, divisionRoll, type Division, type RollEntry } from "./api";

type Student = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  student_code: string | null;
  grade: string | null;
  division: string | null;
};

const fullName = (r: Partial<Student> & { student_code?: string | null }) =>
  [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.student_code || "Unnamed student";

function RollSkeleton() {
  return (
    <ul className="divide-y divide-line-soft" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="px-1 py-3.5">
          <div className="h-4 animate-pulse rounded bg-line-soft" style={{ width: `${52 - i * 8}%` }} />
        </li>
      ))}
    </ul>
  );
}

export default function AddStudentsModal({
  division, onClose, onDone,
}: { division: Division; onClose: () => void; onDone: () => void }) {
  const [all, setAll] = useState<Student[] | null>(null);
  const [already, setAlready] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([
      api<Student[]>("/api/students").catch(() => [] as Student[]),
      divisionRoll(division.id).catch(() => [] as RollEntry[]),
    ]).then(([students, roll]) => {
      if (!live) return;
      setAll(students);
      setAlready(new Set(roll.map((r) => r.id)));
    });
    return () => { live = false; };
  }, [division.id]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all || [])
      .filter((s) => !already.has(s.id))
      .filter((s) => !needle || fullName(s).toLowerCase().includes(needle));
  }, [all, already, q]);

  const label = `${division.grade}${division.division ? ` ${division.division}` : ""}`;

  const save = async () => {
    if (!picked.size || busy) return;
    setBusy(true);
    try {
      await addToDivision(division.id, [...picked]);
      invalidateTeacherClasses();
      flash(`${picked.size} student${picked.size === 1 ? "" : "s"} added to ${label}.`);
      onClose(); onDone();
    } catch (e) {
      flash((e as Error).message || "Could not add those students.", "error");
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add students to ${label}`}
      footer={
        <Button onClick={save} disabled={!picked.size || busy}>
          {busy ? "Adding…" : picked.size ? `Add ${picked.size}` : "Add"}
        </Button>
      }
    >
      <p className="mb-4 rounded-lg border border-line bg-paper-warm px-3 py-2.5 text-[13px] leading-relaxed text-ink-soft">
        These students join the <strong className="font-semibold text-ink">division</strong>,
        so they appear in every subject you teach {label} — not only this one.
      </p>

      <label htmlFor="add-students-search" className="sr-only">Search students</label>
      <input
        id="add-students-search"
        className={inputClasses}
        placeholder="Search students…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="mt-3 max-h-72 overflow-y-auto">
        {all === null ? (
          <RollSkeleton />
        ) : !shown.length ? (
          <p className="py-8 text-center text-sm text-muted">
            {already.size && !q.trim()
              ? "Everyone is already in this division."
              : "No students match that."}
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {shown.map((s) => (
              <li key={s.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-accent"
                    checked={picked.has(s.id)}
                    onChange={(e) =>
                      setPicked((cur) => {
                        const next = new Set(cur);
                        if (e.target.checked) next.add(s.id); else next.delete(s.id);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{fullName(s)}</span>
                  {s.grade && (
                    <span className="shrink-0 text-[13px] text-muted">
                      {s.grade}{s.division ? ` ${s.division}` : ""}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
