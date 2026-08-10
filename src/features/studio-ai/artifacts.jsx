"use client";

// =====================================================================
// What the studio produced, rendered inside the conversation
//
// The pattern every chat assistant converged on: the reply stays prose,
// and anything with structure — a deck, a quiz, an uploaded PDF — gets
// its own card with a viewer suited to it. A quiz printed as markdown is
// a wall of text; the same quiz with its options laid out and the answer
// marked is a thing a teacher can check in ten seconds.
//
// Each viewer is deliberately small and hand-built. A slide deck is a
// list with prev/next, a quiz is a list with an answer key, and a PDF is
// what the browser already renders natively — none of that is worth a
// dependency.
// =====================================================================
import React, { useEffect, useState } from "react";
import {
  FileText, GraduationCap, ClipboardList, Layers, Puzzle,
  ChevronLeft, ChevronRight, Maximize2, X, Check,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { renderMarkdown } from "@/lib/markdown";
import s from "./Studio.module.css";

export const KIND_META = {
  lesson_plan:  { label: "Lesson plan",  icon: FileText,       section: "lesson-plans" },
  quiz:         { label: "Quiz",         icon: GraduationCap,  section: "quizzes" },
  homework:     { label: "Homework",     icon: ClipboardList,  section: "homework" },
  presentation: { label: "Presentation", icon: Layers,         section: "presentations" },
  activity:     { label: "Activity",     icon: Puzzle,         section: "activities" },
};

/* ── slide deck ───────────────────────────────────────────────────── */

/**
 * A generated presentation, one slide at a time.
 *
 * Not a .pptx renderer — the studio produces slide CONTENT, not a
 * PowerPoint file, so the honest viewer is one that shows what was
 * actually made. Export to .pptx belongs with the download button, not
 * here.
 */
export function SlideViewer({ slides = [], onFullscreen }) {
  const [i, setI] = useState(0);
  const n = slides.length;
  if (!n) return <p className="text-sm text-muted">No slides in this deck.</p>;
  const cur = slides[Math.min(i, n - 1)];
  const bullets = Array.isArray(cur?.bullets) ? cur.bullets
    : Array.isArray(cur?.points) ? cur.points
    : typeof cur?.body === "string" ? cur.body.split(/\n+/).filter(Boolean)
    : [];

  const go = (d) => setI((v) => Math.max(0, Math.min(n - 1, v + d)));

  return (
    <div
      onKeyDown={(e) => {
        // Arrow keys move slides when the deck has focus — the one
        // interaction anybody who has used a deck expects.
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      }}
      tabIndex={0}
      role="group"
      aria-label={`Slide ${i + 1} of ${n}`}
      style={{ outline: "none" }}
    >
      <div className={s.slide}>
        <p className={s.slideTitle}>{cur?.title || `Slide ${i + 1}`}</p>
        <div className={s.slideBody}>
          <ul style={{ paddingInlineStart: 18, listStyle: "disc" }}>
            {bullets.map((b, k) => <li key={k}>{typeof b === "string" ? b : b?.text}</li>)}
          </ul>
          {cur?.notes && (
            <p className="text-[11.5px] text-muted mt-3 pt-2 border-t border-dashed border-line">
              <span className="font-mono uppercase tracking-wider text-[9px]">Speaker notes</span>
              <br />{cur.notes}
            </p>
          )}
        </div>
      </div>

      <div className={s.slideRail}>
        <button type="button" className={s.chipBtn} onClick={() => go(-1)} disabled={i === 0} aria-label="Previous slide">
          <ChevronLeft size={14} />
        </button>
        <div className={s.slidePips}>
          {slides.map((_, k) => (
            <button
              key={k} type="button" className={s.slidePip} data-on={k === i}
              onClick={() => setI(k)} aria-label={`Go to slide ${k + 1}`}
            />
          ))}
        </div>
        <button type="button" className={s.chipBtn} onClick={() => go(1)} disabled={i === n - 1} aria-label="Next slide">
          <ChevronRight size={14} />
        </button>
        {onFullscreen && (
          <button type="button" className={s.chipBtn} onClick={() => onFullscreen(i)} aria-label="Present full screen">
            <Maximize2 size={13} />
          </button>
        )}
      </div>
      <p className="text-[11.5px] text-muted text-center mt-2">Slide {i + 1} of {n}</p>
    </div>
  );
}

/** The deck, filling the screen. Escape and arrows, as expected. */
export function SlideFullscreen({ slides, start = 0, onClose }) {
  const [i, setI] = useState(start);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => Math.min(slides.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, onClose]);

  const cur = slides[i] || {};
  const bullets = Array.isArray(cur.bullets) ? cur.bullets : Array.isArray(cur.points) ? cur.points : [];

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Presentation"
      className="fixed inset-0 z-[2147483000] bg-ink/95 flex flex-col items-center justify-center p-8"
    >
      <button
        type="button" onClick={onClose} aria-label="Close presentation"
        className="absolute top-5 end-5 grid place-items-center w-10 h-10 rounded-full text-paper-cool hover:bg-white/10 cursor-pointer"
      >
        <X size={20} />
      </button>
      <div className="w-full max-w-5xl aspect-[16/9] bg-surface rounded-2xl p-10 md:p-14 flex flex-col overflow-hidden">
        <h2 className="font-serif text-3xl md:text-4xl font-semibold text-ink leading-tight">
          {cur.title || `Slide ${i + 1}`}
        </h2>
        <ul className="mt-6 space-y-3 overflow-y-auto" style={{ paddingInlineStart: 22, listStyle: "disc" }}>
          {bullets.map((b, k) => (
            <li key={k} className="text-lg md:text-xl text-ink-soft leading-relaxed">
              {typeof b === "string" ? b : b?.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-4 mt-6 text-paper-cool">
        <button type="button" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0}
                className="grid place-items-center w-10 h-10 rounded-full hover:bg-white/10 disabled:opacity-30 cursor-pointer" aria-label="Previous">
          <ChevronLeft size={20} />
        </button>
        <span className="font-mono text-xs tracking-widest">{i + 1} / {slides.length}</span>
        <button type="button" onClick={() => setI((v) => Math.min(slides.length - 1, v + 1))} disabled={i === slides.length - 1}
                className="grid place-items-center w-10 h-10 rounded-full hover:bg-white/10 disabled:opacity-30 cursor-pointer" aria-label="Next">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

/* ── quiz ─────────────────────────────────────────────────────────── */

/**
 * Questions with their options, the correct one marked.
 *
 * The answer key is shown by default. This is the teacher's copy — the
 * student never sees this screen — and hiding it behind a toggle would
 * only add a click to the thing they are here to check.
 */
export function QuizViewer({ questions = [] }) {
  if (!questions.length) return <p className="text-sm text-muted">No questions in this quiz.</p>;
  const LETTERS = ["A", "B", "C", "D", "E", "F"];

  return (
    <ol className="list-none p-0 m-0">
      {questions.map((q, i) => {
        const choices = Array.isArray(q.choices) ? q.choices : [];
        const answer = q.correct_answer;
        return (
          <li key={q.qid || i} className={s.question}>
            <div className="flex items-baseline gap-2.5">
              <span className={s.qNum}>Q{q.position ?? i + 1}</span>
              {q.marks != null && (
                <span className="text-[10.5px] text-muted font-mono">{q.marks} mark{q.marks === 1 ? "" : "s"}</span>
              )}
              {q.type && (
                <span className="text-[10.5px] text-muted font-mono uppercase tracking-wider ms-auto">{q.type}</span>
              )}
            </div>
            <p className="text-[13.5px] text-ink mt-1.5 leading-snug">{q.prompt}</p>
            {choices.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {choices.map((c, k) => {
                  const text = typeof c === "string" ? c : c?.text ?? "";
                  const correct =
                    answer != null &&
                    (String(answer) === String(text) || String(answer) === LETTERS[k] || Number(answer) === k);
                  return (
                    <div key={k} className={s.choice} data-correct={correct}>
                      <span className={s.choiceKey}>{LETTERS[k]}</span>
                      <span>{text}</span>
                      {correct && <Check size={13} className="flex-shrink-0 mt-0.5" />}
                    </div>
                  );
                })}
              </div>
            )}
            {!choices.length && answer != null && (
              <p className="text-[12.5px] text-ok mt-1.5">
                <span className="font-mono uppercase tracking-wider text-[9.5px] me-1.5">Answer</span>
                {String(answer)}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ── uploaded document ────────────────────────────────────────────── */

/**
 * A PDF or image the teacher attached.
 *
 * Browsers render PDFs natively, so the viewer is an iframe over a
 * signed URL — the bucket is private, and a signed link is what lets the
 * browser fetch it without the file ever passing through a server.
 * pdfjs is already in the bundle for text extraction; using it to paint
 * pages as well would be a second renderer for no gain.
 */
export function DocViewer({ path, name, mime }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data, error: e } = await supabase.storage
          .from("imports").createSignedUrl(path, 3600);
        if (e) throw e;
        if (live) setUrl(data.signedUrl);
      } catch (e) {
        if (live) setError(e.message);
      }
    })();
    return () => { live = false; };
  }, [path]);

  if (error) return <p className="text-sm text-ink-soft">Couldn&rsquo;t open {name}: {error}</p>;
  if (!url) return <div className="animate-pulse h-40 rounded-lg bg-line/40" aria-hidden="true" />;

  if (mime?.startsWith("image/")) {
    return <img src={url} alt={name} className="max-w-full rounded-lg border border-line" />;
  }
  return <iframe src={url} title={name} className={s.docFrame} />;
}

/* ── the card ─────────────────────────────────────────────────────── */

/** Header chrome shared by every artifact, whatever it holds. */
export function ArtifactCard({ kind, title, children, actions }) {
  const meta = KIND_META[kind] || { label: kind, icon: FileText };
  const Icon = meta.icon;
  return (
    <div className={s.artifact}>
      <div className={s.artifactHead}>
        <span className={s.artifactIcon}><Icon size={15} /></span>
        <span className="min-w-0 flex-1">
          <span className={s.artifactKind}>{meta.label}</span>
          <span className={`${s.artifactTitle} block truncate`}>{title || "Untitled"}</span>
        </span>
        {actions}
      </div>
      <div className={s.artifactBody}>{children}</div>
    </div>
  );
}

/** Prose artifacts — lesson plans, homework, activities. */
export function MarkdownBody({ markdown }) {
  return <div className={s.reply} dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown || "") }} />;
}
