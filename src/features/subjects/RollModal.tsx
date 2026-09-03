"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/views/_shared";
import { divisionRoll, removeFromDivision, type Division, type RollEntry } from "./api";

const divisionLabel = (d: Division) => `${d.grade}${d.division ? ` ${d.division}` : ""}`;

const fullName = (r: { first_name?: string | null; last_name?: string | null; student_code?: string | null }) =>
  [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.student_code || "Unnamed student";

/** The roll itself. This is the list every subject on the division shares. */
export default function RollModal({ division, onClose, onDone }: { division: Division; onClose: () => void; onDone: () => void }) {
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
