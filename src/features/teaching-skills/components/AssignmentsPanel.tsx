"use client";

// =====================================================================
// Where a skill applies — grade / section / subject combos
//
// One skill can cover several classes; one class can draw on several
// skills for different subjects. Both directions are legal, so the only
// hard rule is "no exact repeat on the same skill" (the DB's unique
// index backs it). The same combination appearing on ANOTHER skill is
// allowed — the generator draws on both — but it is said out loud,
// warn-don't-block, the same manners as the scheduler's clash check.
// An empty field means "any": a skill with no combos at all is global.
// =====================================================================
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { AudienceSelect, useTeacherClasses } from "@/views/_shared";
import { MAJORS } from "@/lib/enums";
import { useAccount } from "@/lib/account";
import type { SkillAssignment } from "../api";
import s from "./TeachingSkills.module.css";

const norm = (v: string | null | undefined) => (v || "").trim().toLowerCase();
const sameCombo = (a: { grade?: string | null; section?: string | null; subject?: string | null }, b: typeof a) =>
  norm(a.grade) === norm(b.grade) && norm(a.section) === norm(b.section) && norm(a.subject) === norm(b.subject);

export function comboLabel(a: { grade?: string | null; section?: string | null; subject?: string | null }) {
  const parts = [
    a.grade ? `Grade ${a.grade}`.replace(/^Grade Grade/i, "Grade") : "All grades",
    a.section ? `Section ${a.section}`.replace(/^Section Section/i, "Section") : null,
    a.subject || null,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function AssignmentsPanel({
  assignments,
  others,
  onAdd,
  onRemove,
}: {
  /** This skill's combos. */
  assignments: SkillAssignment[];
  /** Every other skill's combos, for the overlap notice. */
  others: SkillAssignment[];
  onAdd: (combo: { grade: string | null; section: string | null; subject: string | null }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { grades, sections } = useTeacherClasses();
  const account = useAccount();
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A dropdown, not free text, so "Physics" is spelled one way across
  // every skill and the generator's matching stays exact. The teacher's
  // own majors lead the list; the shared MAJORS vocabulary (the same
  // one the studio dropdowns use) fills in the rest.
  const mine = (account?.profile?.majors || []).filter(Boolean);
  const subjects = [
    ...mine,
    ...MAJORS.filter((m: string) => !mine.some((x: string) => x.toLowerCase() === m.toLowerCase())),
  ];

  const add = async () => {
    if (busy) return;
    const combo = { grade: grade || null, section: section || null, subject: subject.trim() || null };
    if (assignments.some((a) => sameCombo(a, combo))) {
      setNote("This skill already covers that exact combination.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await onAdd(combo);
      if (others.some((a) => sameCombo(a, combo))) {
        setNote("Added — note that another skill also covers this combination, so the generator will draw on both.");
      }
    } catch (e: any) {
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.assign}>
      <p className={s.eyebrow}>Applies to</p>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {assignments.length === 0 && (
          <span className="text-[12.5px] text-muted">
            Everything — add a grade, section or subject to narrow it.
          </span>
        )}
        {assignments.map((a) => (
          <span key={a.id} className={s.assignChip}>
            {comboLabel(a)}
            <button
              type="button"
              aria-label={`Remove ${comboLabel(a)}`}
              onClick={() => onRemove(a.id).catch((e) => setNote(e.message))}
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <div className="w-36">
          <AudienceSelect value={grade} onChange={setGrade} options={grades} allLabel="All grades" emptyNote="No grades yet" />
        </div>
        <div className="w-36">
          <AudienceSelect value={section} onChange={setSection} options={sections} allLabel="All sections" emptyNote="No sections yet" />
        </div>
        <div className="w-44">
          <AudienceSelect value={subject} onChange={setSubject} options={subjects} allLabel="Any subject" emptyNote="No subjects yet" />
        </div>
        <button type="button" className={s.iconBtn} title="Add this combination" onClick={add} disabled={busy}>
          <Plus size={15} />
        </button>
      </div>
      {note && <p className="text-[12.5px] text-muted mt-1.5">{note}</p>}
    </div>
  );
}
