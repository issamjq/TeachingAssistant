"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/views/_shared";
import { listSubmissions, createSubmission, withdrawSubmission } from "../api";
import { KIND_LABEL, subjectLabel } from "../labels";
import type { DocKind, Submission } from "../types";
import s from "../TemplateLibrary.module.css";

const STATUS_COPY: Record<Submission["status"], string> = {
  pending: "In review",
  approved: "Published",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
};

const SUBMITTABLE: DocKind[] = [
  "lesson_plan",
  "teaching_guide",
  "student_notes",
  "presentation",
  "quiz",
  "homework",
  "activity",
];

// A teacher's own contributions to the shelf. Everything here is
// moderated — nothing auto-publishes — so the panel is honest about
// state: In review until a superadmin decides, with the reviewer's note
// shown when there is one. Up to five open submissions at a time.
export function SubmissionsPanel() {
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [deleting, setDeleting] = useState<Submission | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  // compose form
  const [grade, setGrade] = useState("9");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [kind, setKind] = useState<DocKind>("lesson_plan");
  const [contentMd, setContentMd] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    listSubmissions()
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  const openCount = (rows ?? []).filter((r) => r.status === "pending").length;

  const submit = async () => {
    if (!chapter.trim() || !subject.trim() || !contentMd.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createSubmission({
        curriculum: "cbse",
        grade: Number(grade) || 0,
        subject: subject.trim().toLowerCase(),
        chapter_title: chapter.trim(),
        title: `${chapter.trim()} — Grade ${grade}`,
        documents: [{ kind, content_md: contentMd.trim() }],
      });
      setRows((r) => [
        {
          id: created.id,
          status: created.status,
          curriculum: "cbse",
          grade: Number(grade) || 0,
          subject: subject.trim().toLowerCase(),
          chapter_title: chapter.trim(),
          title: `${chapter.trim()} — Grade ${grade}`,
          review_note: null,
        },
        ...(r ?? []),
      ]);
      setComposing(false);
      setChapter("");
      setSubject("");
      setContentMd("");
    } catch (e: any) {
      setError(e.message || "Couldn't submit that.");
    } finally {
      setSaving(false);
    }
  };

  const confirmWithdraw = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await withdrawSubmission(deleting.id);
      setRows((r) =>
        (r ?? []).map((x) =>
          x.id === deleting.id ? { ...x, status: "withdrawn" } : x,
        ),
      );
      setDeleting(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div className="space-y-4 max-w-[900px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink-soft max-w-xl">
          Share a chapter you have built with every teacher on Murchid. A superadmin reviews
          each one before it appears on the shelf — nothing publishes on its own.
        </p>
        <Button
          variant="secondary"
          onClick={() => setComposing((v) => !v)}
          disabled={openCount >= 5 && !composing}
          title={openCount >= 5 ? "You already have five submissions in review" : undefined}
        >
          <Plus size={15} /> Submit a chapter
        </Button>
      </div>

      {openCount >= 5 && (
        <p className="text-[12.5px] text-muted">
          Five submissions are in review — the most allowed at once. Withdraw one to add another.
        </p>
      )}

      {error && <p className="text-[13px] text-crit">{error}</p>}

      {composing && (
        <section className={`${s.glass} p-4 md:p-5 space-y-3`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-[12.5px] text-muted space-y-1">
              Grade
              <select className={`${s.field} w-full`} value={grade} onChange={(e) => setGrade(e.target.value)}>
                {Array.from({ length: 13 }, (_, i) => i).map((g) => (
                  <option key={g} value={g}>
                    {g === 0 ? "KG" : `Grade ${g}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12.5px] text-muted space-y-1">
              Subject
              <input
                className={`${s.field} w-full`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. physics"
              />
            </label>
            <label className="text-[12.5px] text-muted space-y-1">
              Kind
              <select
                className={`${s.field} w-full`}
                value={kind}
                onChange={(e) => setKind(e.target.value as DocKind)}
              >
                {SUBMITTABLE.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-[12.5px] text-muted space-y-1 block">
            Chapter title
            <input
              className={`${s.field} w-full`}
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="e.g. Motion"
            />
          </label>
          <label className="text-[12.5px] text-muted space-y-1 block">
            The document (Markdown)
            <textarea
              className={`${s.field} w-full`}
              style={{ minHeight: 160, fontFamily: "var(--font-mono)", fontSize: 12.5 }}
              value={contentMd}
              onChange={(e) => setContentMd(e.target.value)}
              placeholder="# Motion&#10;&#10;## Learning objectives…"
            />
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={submit} disabled={saving || !chapter.trim() || !subject.trim() || !contentMd.trim()}>
              <Send size={15} /> {saving ? "Submitting…" : "Submit for review"}
            </Button>
            <Button variant="ghost" onClick={() => setComposing(false)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {rows === null ? (
        <p className="text-sm text-muted">Loading your submissions…</p>
      ) : rows.length === 0 ? (
        <section className={`${s.glass} p-6 text-center`}>
          <p className="text-sm text-ink-soft max-w-md mx-auto">
            You haven't submitted anything yet. Built a chapter your colleagues would use? Share it.
          </p>
        </section>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className={s.subRow}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {r.chapter_title}
                  <span className="text-muted font-normal">
                    {" "}
                    · Grade {r.grade} · {subjectLabel(r.subject)}
                  </span>
                </p>
                {r.review_note && (
                  <p className="text-[12.5px] text-muted mt-0.5">Reviewer: {r.review_note}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-none">
                <span className={s.pill} data-status={r.status}>
                  {STATUS_COPY[r.status]}
                </span>
                {r.status === "pending" && (
                  <button
                    type="button"
                    className={s.closeBtn}
                    onClick={() => setDeleting(r)}
                    aria-label="Withdraw submission"
                    title="Withdraw"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmWithdraw}
        busy={busyDelete}
        title="Withdraw this submission?"
        message={`"${deleting?.chapter_title || "This chapter"}" will be pulled from the review queue. You can submit it again later.`}
      />
    </div>
  );
}
