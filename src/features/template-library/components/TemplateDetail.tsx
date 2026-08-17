"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Download, Import, Sparkles, Check, ArrowRight } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";
import { navigate } from "@/lib/route";
import { PREFILL_KEY } from "@/shared/lib/assistantPrefill";
import { Button } from "@/components/ui/button";
import { api } from "@/shared/lib/apiClient";
import { getTemplate, markUsed } from "../api";
import { KIND_LABEL, IMPORT_PATH, IMPORT_DEST, STUDIO_KIND, subjectLabel } from "../labels";
import type { TemplateDetail as Detail, TemplateSummary } from "../types";
import s from "../TemplateLibrary.module.css";

// The card's documents, opened over the shelf. Bodies load here (a card
// never carries them), each document a tab. Two ways out: import a
// document straight into the matching library store (browser→Supabase,
// works even while generation is cold), or open it in the Studio to
// adapt it to your own class before saving.
export function TemplateDetail({
  card,
  onClose,
}: {
  card: TemplateSummary;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<Record<number, boolean>>({});
  // Where the last import landed, so the teacher can jump straight to it —
  // an import you can't find is no import at all.
  const [saved, setSaved] = useState<{ label: string; target: string[] } | null>(null);

  // The parent remounts this per card (key={card.id}), so state starts
  // fresh every open — no synchronous reset needed here.
  useEffect(() => {
    let live = true;
    getTemplate(card.id)
      .then((d) => {
        if (!live) return;
        setDetail(d);
        setTab(0);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [card.id]);

  // Close on Escape — a drawer that only closes by mouse is a drawer you
  // resent on a laptop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const docs = detail?.documents ?? [];
  const doc = docs[tab];

  const title = detail?.chapter_title || card.chapter_title;

  const structuredQuestions = useMemo(() => {
    if (!doc || doc.kind !== "quiz") return null;
    const st = doc.structured as { questions?: unknown } | null;
    return Array.isArray(st?.questions) ? (st!.questions as unknown[]) : null;
  }, [doc]);

  const importDoc = async () => {
    if (!doc) return;
    const path = IMPORT_PATH[doc.kind];
    if (!path) return;
    setImporting(true);
    setError(null);
    const name = doc.title?.trim() || title;
    try {
      let created: { id?: string } | null = null;
      if (doc.kind === "quiz" && structuredQuestions) {
        created = await api("/api/quizzes/bulk", {
          method: "POST",
          body: { name, title: name, questions: structuredQuestions },
        });
      } else if (doc.kind === "lesson_plan") {
        // A lesson template is a rich Markdown document, not a handful of
        // short fields — so keep it as `body_md`, which the lesson editor
        // renders as a readable document. Dumping it into the one-line
        // `main_activity` box (what we did before) was the wall of raw
        // Markdown a teacher couldn't read.
        created = await api(path, {
          method: "POST",
          body: { name, title: name, subject: card.subject, body_md: doc.content_md },
        });
      } else {
        created = await api(path, {
          method: "POST",
          body: {
            name,
            title: name,
            main_activity: doc.content_md,
            instructions: doc.content_md,
            body_md: doc.content_md,
          },
        });
      }
      setImported((m) => ({ ...m, [tab]: true }));
      const dest = IMPORT_DEST[doc.kind];
      if (dest && created?.id) setSaved({ label: dest.label, target: dest.route(created.id) });
      // Count the import — best-effort, never blocks the save.
      markUsed(card.id).catch(() => {});
    } catch (e: any) {
      setError(e.message || "Couldn't import that.");
    } finally {
      setImporting(false);
    }
  };

  // Hand the document to the Studio to adapt. Reuses the assistant's
  // one-navigation prefill channel: the composer seeds with the text and
  // the right format is preselected. Nothing generates until the teacher
  // presses send — this is a starting point, not an auto-run.
  const openInStudio = () => {
    if (!doc) return;
    const kind = STUDIO_KIND[doc.kind];
    const body = doc.content_md.slice(0, 6000);
    const prompt =
      `Adapt this ${KIND_LABEL[doc.kind].toLowerCase()} on "${title}" ` +
      `(Grade ${card.grade} ${subjectLabel(card.subject)}) for my class — keep the structure, ` +
      `adjust examples and difficulty to how I teach:\n\n${body}`;
    try {
      sessionStorage.setItem(
        PREFILL_KEY,
        JSON.stringify({ action: "create_work", at: Date.now(), kind, prompt }),
      );
    } catch {
      /* private mode — the Studio still opens, just at a blank composer */
    }
    markUsed(card.id).catch(() => {});
    navigate(["studio", kind]);
  };

  const downloadMd = () => {
    if (!doc) return;
    const blob = new Blob([doc.content_md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(doc.title || title).replace(/[^\w.-]+/g, "-").slice(0, 80)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canImport = doc ? !!IMPORT_PATH[doc.kind] : false;

  return (
    <>
      <div className={s.overlay} onClick={onClose} aria-hidden />
      <aside
        className={s.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} — template`}
      >
        <header className={s.drawerHead}>
          <div className="min-w-0">
            <p className={s.eyebrow}>
              Grade {card.grade} · {subjectLabel(card.subject)}
              {detail?.curriculum ? ` · ${detail.curriculum.toUpperCase()}` : ""}
            </p>
            <h2 className="font-serif text-[22px] leading-tight mt-1 truncate">{title}</h2>
          </div>
          <button type="button" className={s.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {docs.length > 0 && (
          <div className={s.docTabs} role="tablist">
            {docs.map((d, i) => (
              <button
                key={`${d.kind}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === tab}
                className={s.docTab}
                data-on={i === tab}
                onClick={() => setTab(i)}
              >
                {d.title?.trim() || KIND_LABEL[d.kind] || d.kind}
              </button>
            ))}
          </div>
        )}

        <div className={s.drawerBody}>
          {error && <p className="text-[13px] text-crit">{error}</p>}
          {!detail && !error && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className={s.thinkDot} />
              <span className={s.thinkDot} />
              <span className={s.thinkDot} />
              Opening…
            </div>
          )}
          {doc && (
            <div className={s.docBody}>{renderMarkdown(doc.content_md || "")}</div>
          )}
        </div>

        {doc && (
          <footer className={s.drawerFoot}>
            {saved && (
              <div className={s.savedStrip}>
                <span className="inline-flex items-center gap-1.5 text-[13px]">
                  <Check size={15} className="text-accent" aria-hidden />
                  Saved to <b className="font-medium">{saved.label}</b>
                </span>
                <Button size="sm" onClick={() => navigate(saved.target)}>
                  View in {saved.label} <ArrowRight size={14} />
                </Button>
              </div>
            )}
            {canImport ? (
              <Button onClick={importDoc} disabled={importing || imported[tab]}>
                {imported[tab] ? (
                  <>
                    <Check size={15} /> Imported
                  </>
                ) : importing ? (
                  "Importing…"
                ) : (
                  <>
                    <Import size={15} /> Import {KIND_LABEL[doc.kind].toLowerCase()}
                  </>
                )}
              </Button>
            ) : (
              <span className="text-[12.5px] text-muted">
                {KIND_LABEL[doc.kind]} has no library store — open it in the Studio to keep it.
              </span>
            )}
            <Button variant="secondary" onClick={openInStudio}>
              <Sparkles size={15} /> Open in Studio
            </Button>
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={downloadMd} aria-label="Download as Markdown">
              <Download size={15} /> .md
            </Button>
          </footer>
        )}
      </aside>
    </>
  );
}
