"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Download, Import, Sparkles, Check, ArrowRight } from "lucide-react";
import { renderMarkdown } from "@/lib/markdown";
import { navigate } from "@/lib/route";
import { PREFILL_KEY } from "@/shared/lib/assistantPrefill";
import { Button } from "@/components/ui/button";
import { api } from "@/shared/lib/apiClient";
import { getTemplate, markUsed } from "../api";
import { KIND_LABEL, IMPORT_PATH, IMPORT_DEST, LESSON_KINDS, STUDIO_KIND, subjectLabel } from "../labels";
import type { TemplateDetail as Detail, TemplateDocument, TemplateSummary, DocKind } from "../types";
import s from "../TemplateLibrary.module.css";

// A leading `# Chapter` in a document repeats the drawer's own title (and,
// in the merged lesson view, would repeat it three times over). Strip that
// one line — our section headings already name each part.
const stripLeadingH1 = (md: string) => (md || "").replace(/^\s*#\s+.*(?:\r?\n|$)/, "");

// A tab in the drawer. The lesson family (plan + teaching guide + student
// notes) collapses into ONE "Lesson" section shown as a single scroll with
// headings, because to a teacher they are one thing. Every other kind is
// its own section.
interface Section {
  key: string;
  label: string;
  kind: DocKind; // representative kind (for Studio / import routing)
  docs: TemplateDocument[];
  isLesson: boolean;
}

const quizQuestionsOf = (d: TemplateDocument): unknown[] | null => {
  if (d.kind !== "quiz") return null;
  const st = d.structured as { questions?: unknown } | null;
  return Array.isArray(st?.questions) ? (st!.questions as unknown[]) : null;
};

// The card's documents, opened over the shelf. Bodies load here (a card
// never carries them). Two ways out of any section: import it into the
// matching store (browser→Supabase, works even while generation is cold),
// or open it in the Studio to adapt before saving.
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

  const title = detail?.chapter_title || card.chapter_title;

  // Group the documents into sections: the lesson family merged into one,
  // everything else on its own — in document order, lesson pack first.
  const sections = useMemo<Section[]>(() => {
    const docs = detail?.documents ?? [];
    const lessonDocs = LESSON_KINDS.flatMap((k) => docs.filter((d) => d.kind === k));
    const others = docs.filter((d) => !LESSON_KINDS.includes(d.kind));
    const out: Section[] = [];
    if (lessonDocs.length) {
      out.push({ key: "lesson", label: "Lesson", kind: "lesson_plan", docs: lessonDocs, isLesson: true });
    }
    for (const d of others) {
      out.push({
        key: `${d.kind}`,
        label: d.title?.trim() || KIND_LABEL[d.kind] || d.kind,
        kind: d.kind,
        docs: [d],
        isLesson: false,
      });
    }
    return out;
  }, [detail]);

  const section: Section | undefined = sections[tab];

  // Import the active section. The lesson family is ONE lesson, so its
  // plan, guide and notes import as a single merged document (the same
  // scroll shown here) — not three rows the teacher then can't find
  // together. Every other section is its own single import.
  const importSection = async () => {
    if (!section) return;
    setImporting(true);
    setError(null);
    try {
      let created: { id?: string } | null = null;
      if (section.isLesson) {
        // One row, whole lesson: plan + guide + notes under their headings,
        // stored as body_md so the lesson editor renders the full scroll.
        created = await api(IMPORT_PATH.lesson_plan!, {
          method: "POST",
          body: { name: title, title, subject: card.subject, body_md: sectionMarkdown(section) },
        });
      } else {
        const d = section.docs[0];
        const path = IMPORT_PATH[d.kind];
        const name = d.title?.trim() || title;
        const questions = quizQuestionsOf(d);
        if (path && d.kind === "quiz" && questions) {
          created = await api("/api/quizzes/bulk", {
            method: "POST",
            body: { name, title: name, questions },
          });
        } else if (path) {
          created = await api(path, {
            method: "POST",
            body: {
              name,
              title: name,
              main_activity: d.content_md,
              instructions: d.content_md,
              body_md: d.content_md,
            },
          });
        }
      }
      if (!created?.id) {
        setError("Couldn't import that.");
        return;
      }
      setImported((m) => ({ ...m, [tab]: true }));
      const dest = IMPORT_DEST[section.kind];
      if (dest) setSaved({ label: dest.label, target: dest.route(created.id) });
      // Count the import — best-effort, never blocks the save.
      markUsed(card.id).catch(() => {});
    } catch (e: any) {
      setError(e.message || "Couldn't import that.");
    } finally {
      setImporting(false);
    }
  };

  // The section's Markdown as one document — the lesson pack joined under
  // its part headings, or the single document as-is.
  const sectionMarkdown = (sec: Section): string =>
    sec.isLesson
      ? sec.docs.map((d) => `## ${KIND_LABEL[d.kind]}\n\n${stripLeadingH1(d.content_md)}`).join("\n\n")
      : sec.docs[0]?.content_md || "";

  // Hand the section to the Studio to adapt. Reuses the assistant's
  // one-navigation prefill channel: the composer seeds with the text and
  // the right format is preselected. Nothing generates until the teacher
  // presses send — a starting point, not an auto-run.
  const openInStudio = () => {
    if (!section) return;
    const kind = STUDIO_KIND[section.kind];
    const body = sectionMarkdown(section).slice(0, 6000);
    const what = section.isLesson ? "lesson" : KIND_LABEL[section.kind].toLowerCase();
    const prompt =
      `Adapt this ${what} on "${title}" ` +
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
    if (!section) return;
    const blob = new Blob([sectionMarkdown(section)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w.-]+/g, "-").slice(0, 80)}-${section.key}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canImport = section ? section.docs.some((d) => IMPORT_PATH[d.kind]) : false;

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

        {sections.length > 1 && (
          <div className={s.docTabs} role="tablist">
            {sections.map((sec, i) => (
              <button
                key={sec.key}
                type="button"
                role="tab"
                aria-selected={i === tab}
                className={s.docTab}
                data-on={i === tab}
                onClick={() => setTab(i)}
              >
                {sec.label}
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
          {section &&
            (section.isLesson ? (
              // The lesson family in one scroll: plan, then guide, then
              // notes, each under its own heading.
              section.docs.map((d, i) => (
                <section key={`${d.kind}-${i}`} className={s.docPart}>
                  <p className={s.docPartHead}>{KIND_LABEL[d.kind]}</p>
                  <div className={s.docBody}>{renderMarkdown(stripLeadingH1(d.content_md))}</div>
                </section>
              ))
            ) : (
              <div className={s.docBody}>{renderMarkdown(section.docs[0]?.content_md || "")}</div>
            ))}
        </div>

        {section && (
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
              <Button onClick={importSection} disabled={importing || imported[tab]}>
                {imported[tab] ? (
                  <>
                    <Check size={15} /> Imported
                  </>
                ) : importing ? (
                  "Importing…"
                ) : section.isLesson ? (
                  <>
                    <Import size={15} /> Import to Lessons
                  </>
                ) : (
                  <>
                    <Import size={15} /> Import {KIND_LABEL[section.kind].toLowerCase()}
                  </>
                )}
              </Button>
            ) : (
              <span className="text-[12.5px] text-muted">
                {KIND_LABEL[section.kind]} has no library store — open it in the Studio to keep it.
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
