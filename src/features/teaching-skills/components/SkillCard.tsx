"use client";

// One saved skill profile: rendered (never raw Markdown), collapsed past
// ~a screenful with a Read-more, editable in place, downloadable as .md,
// and carrying its own "applies to" combos.
import { useState } from "react";
import { Download, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import type { SkillRow, SkillAssignment } from "../api";
import { updateSkill } from "../api";
import { AssignmentsPanel } from "./AssignmentsPanel";
import s from "./TeachingSkills.module.css";

const SOURCE_LABEL: Record<string, string> = {
  interview: "From the interview",
  generation: "Saved from a generation",
  cv: "From your CV",
};

export function SkillCard({
  row,
  assignments,
  others,
  onPatched,
  onDelete,
  onAddAssignment,
  onRemoveAssignment,
}: {
  row: SkillRow;
  assignments: SkillAssignment[];
  others: SkillAssignment[];
  onPatched: (row: SkillRow) => void;
  onDelete: () => void;
  onAddAssignment: (combo: { grade: string | null; section: string | null; subject: string | null }) => Promise<void>;
  onRemoveAssignment: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const long = (row.skill_profile || "").length > 700;

  const download = () => {
    const blob = new Blob([row.skill_profile || ""], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(row.name || "teaching-profile").replace(/[^\w؀-ۿ-]+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveEdit = async () => {
    try {
      const updated = await updateSkill(row.id, { skill_profile: editText });
      onPatched(updated);
      setEditing(false);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <section className={`${s.glass} p-5 md:p-6`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <p className={s.eyebrow}>
            {SOURCE_LABEL[row.source_type || ""] || "Uploaded"}
            {" · "}
            {new Date(row.updated_at).toLocaleDateString()}
          </p>
          <h2 className="font-serif text-[19px] mt-1">{row.name || "Teaching profile"}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className={s.iconBtn} title="Download as Markdown" onClick={download}>
            <Download size={15} />
          </button>
          <button
            type="button"
            className={s.iconBtn}
            title="Edit"
            onClick={() => {
              setEditing(true);
              setEditText(row.skill_profile || "");
            }}
          >
            <Pencil size={15} />
          </button>
          <button type="button" className={s.iconBtn} title="Delete" onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            className={s.reviewInput}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={14}
            aria-label="Edit profile Markdown"
          />
          <div className="flex items-center gap-2">
            <Button onClick={saveEdit}>Save changes</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <div className={s.profileBody} data-clamped={long && !open ? "true" : undefined}>
              {renderMarkdown(row.skill_profile || "")}
            </div>
            {long && !open && <span className={s.profileFade} aria-hidden />}
          </div>
          {long && (
            <button type="button" className={s.readMore} onClick={() => setOpen((v) => !v)}>
              {open ? (
                <>Show less <ChevronUp size={12} /></>
              ) : (
                <>Read the full profile <ChevronDown size={12} /></>
              )}
            </button>
          )}
        </>
      )}

      {error && <p className="text-[12.5px] text-crit mt-2">{error}</p>}

      <AssignmentsPanel
        assignments={assignments}
        others={others}
        onAdd={onAddAssignment}
        onRemove={onRemoveAssignment}
      />
    </section>
  );
}
