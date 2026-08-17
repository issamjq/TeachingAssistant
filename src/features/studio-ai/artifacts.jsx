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
  // The other two thirds of a lesson. With no entry here both rendered with a
  // raw "STUDENT_NOTES" eyebrow and reported themselves as a lesson plan.
  // No `section`: they are read inside the lesson, not as a library of their
  // own, so an "Open teaching guides" button would lead nowhere.
  teaching_guide: { label: "Teaching guide", icon: GraduationCap },
  student_notes:  { label: "Student notes",  icon: ClipboardList },
  quiz:         { label: "Quiz",         icon: GraduationCap,  section: "quizzes" },
  homework:     { label: "Homework",     icon: ClipboardList,  section: "homework" },
  presentation: { label: "Presentation", icon: Layers,         section: "presentations" },
  activity:     { label: "Activity",     icon: Puzzle,         section: "activities" },
};

/* ── slide deck ───────────────────────────────────────────────────── */

/**
 * A deck read straight out of its markdown.
 *
 * Every generated deck is also asked for a structured form, and that is what
 * the viewer prefers — but it is a second call to a model, and on a small one
 * it comes back hollow often enough to matter: titles with no bullets, or
 * nothing at all. The deck then rendered as raw markdown, with the Note, Say
 * and Show cues run together into one grey paragraph.
 *
 * None of that is necessary. The markdown has a fixed shape — slides split on
 * "---", a "## " title, "- " bullets, and one blockquote per cue — so it can
 * be read in code, exactly, every time, for nothing. The model is only asked
 * for the parts a model is needed for.
 */
export function slidesFromMarkdown(markdown) {
  const text = String(markdown || "");
  if (!text.trim()) return [];

  const cue = (block, name) => {
    const m = block.match(
      new RegExp(`^>\\s*\\*{0,2}${name}:?\\*{0,2}\\s*(.+(?:\\n(?!>).*)*)`, "im"),
    );
    return m ? m[1].replace(/\n>?\s*/g, " ").replace(/\*\*/g, "").trim() : "";
  };

  /**
   * Slides are separated by "---", or by their own headings when the
   * generator left the rules out.
   *
   * The format asks for "---" between slides and it is usually there — but a
   * deck written as a run of "## " headings is the same deck, and reading it
   * as ONE slide with forty bullets on it is the worst of the three possible
   * outcomes. So the rules are used when they exist and the headings when
   * they do not.
   */
  const byRule = text.split(/\n\s*---+\s*\n/);
  const blocks =
    byRule.length > 1
      ? byRule
      : text.split(/\n(?=\s*#{1,3}\s+)/);

  return blocks
    .map((block) => {
      // A heading carrying "::" is an item that landed where a title goes; the
      // half before it is still the name of the thing.
      const title =
        block
          .match(/^\s*#{1,3}\s+(.+)$/m)?.[1]
          ?.split("::")[0]
          .replace(/\*\*/g, "")
          .trim() || "";

      /**
       * The diagram, as the generator wrote it.
       *
       * Fenced rather than mixed into the prose, because a numbered list of
       * steps and a bulleted list of points are the same characters and the
       * parser has to tell them apart every time, not usually.
       */
      const asItem = (line) => {
        const [label, ...rest] = String(line).split("::");
        return {
          label: String(label || "")
            .replace(/^[-*\d.)\s#]+/, "")
            .replace(/\*\*/g, "")
            .trim(),
          detail: rest.join("::").replace(/\*\*/g, "").trim(),
        };
      };

      /**
       * Item lines, fenced or not.
       *
       * The format asks for a ":::items" fence and the fence is easy to read —
       * but a generator that writes the same lines without it, or puts one of
       * them where a title goes, has still said exactly what the diagram is.
       * Insisting on the fence threw that away and rendered a sequence as five
       * separate slides with "::" showing in their titles.
       *
       * "label :: detail" is unambiguous enough to find anywhere. Blockquotes
       * are excluded because the Say and Show cues are prose, and prose
       * contains colons.
       */
      const fence = block.match(/^:::\s*items\s*\n([\s\S]*?)^:::/m);
      const itemSource = fence
        ? fence[1]
        : block
            .split(/\n/)
            .filter((line) => !/^\s*>/.test(line) && /\s::\s/.test(line))
            .join("\n");

      const items = itemSource
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(asItem)
        .filter((x) => x.label && x.detail);

      // Bullets, minus anything that was inside the fence.
      const outsideFence = block.replace(/^:::[\s\S]*?^:::/gm, "");
      const bullets = [...outsideFence.matchAll(/^\s*[-*]\s+(.+)$/gm)]
        .map((m) => m[1].replace(/\*\*/g, "").trim())
        // A line already drawn as part of the diagram is not also a bullet.
        .filter((b) => b && !/\s::\s/.test(b));

      const layout = block.match(/^\s*Layout:\s*([a-z]+)/im)?.[1]?.toLowerCase();

      return {
        title,
        // What it says it is; failing that, what it looks like.
        layout: layout || (items.length ? "steps" : bullets.length ? "bullets" : "statement"),
        bullets,
        items,
        note: cue(block, "Note"),
        visual: cue(block, "Show"),
        notes: cue(block, "Say"),
        onScreen: cue(block, "On screen"),
        pause: cue(block, "Pause"),
      };
    })
    // A block with no title and no bullets is the preamble before slide one,
    // not a slide.
    .filter((x) => x.title || x.bullets.length || x.items.length);
}

/**
 * A generated presentation, one slide at a time.
 *
 * Not a .pptx renderer — the studio produces slide CONTENT, not a
 * PowerPoint file, so the honest viewer is one that shows what was
 * actually made. Export to .pptx belongs with the download button, not
 * here.
 */
/**
 * The diagram, drawn.
 *
 * A slide's items are the same data whichever way they are arranged — three
 * labelled points are a sequence, a cycle, or a comparison depending only on
 * what the idea is. So the data is written once by the generator and the
 * arrangement is chosen here, which is why a deck stops looking like a list
 * of lists and starts looking like it was designed.
 *
 * Everything is drawn in CSS. There is no image model behind this and
 * pretending otherwise would put a broken picture on a classroom wall — what
 * there is instead is real structure: numbered flow, a ring, columns, callouts
 * around a subject.
 */
function SlideItems({ layout, items, title }) {
  if (!items?.length) return null;

  /**
   * One point, already named by the slide's own title.
   *
   * A generator that gives a stage a slide of its own writes the name twice —
   * once as the heading and once as the only card under it — and a numbered
   * "1" over a list of one is a diagram of nothing. The sentence is the whole
   * content, so it is set as one.
   */
  if (
    items.length === 1 &&
    items[0].detail &&
    items[0].label.trim().toLowerCase() === String(title || "").trim().toLowerCase()
  ) {
    return <p className={s.statement}>{items[0].detail}</p>;
  }

  if (layout === "stat") {
    const [first] = items;
    return (
      <div className={s.statWrap}>
        <p className={s.statNumber}>{first.label}</p>
        {first.detail && <p className={s.statCaption}>{first.detail}</p>}
      </div>
    );
  }

  if (layout === "compare") {
    return (
      <div className={s.compareWrap} data-cols={items.length}>
        {items.map((it, i) => (
          <div key={i} className={s.compareCol}>
            <p className={s.compareLabel}>{it.label}</p>
            {it.detail && <p className={s.compareDetail}>{it.detail}</p>}
          </div>
        ))}
      </div>
    );
  }

  if (layout === "cycle") {
    return (
      <div className={s.cycleWrap}>
        {items.map((it, i) => (
          <div key={i} className={s.cycleNode}>
            <span className={s.cycleDot}>{i + 1}</span>
            <p className={s.cycleLabel}>{it.label}</p>
            {it.detail && <p className={s.cycleDetail}>{it.detail}</p>}
            {/* The arrow that makes it a cycle rather than a row: the last
                one points back to the first. */}
            <span className={s.cycleArrow} aria-hidden="true">
              {i === items.length - 1 ? "\u21ba" : "\u2192"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (layout === "parts") {
    return (
      <div className={s.partsWrap}>
        {items.map((it, i) => (
          <div key={i} className={s.partCallout}>
            <span className={s.partPin} aria-hidden="true" />
            <p className={s.partLabel}>{it.label}</p>
            {it.detail && <p className={s.partDetail}>{it.detail}</p>}
          </div>
        ))}
      </div>
    );
  }

  // steps, and anything unrecognised that still has ordered points
  return (
    <div className={s.stepsWrap}>
      {items.map((it, i) => (
        <div key={i} className={s.stepCard}>
          <span className={s.stepNum}>{i + 1}</span>
          <div>
            <p className={s.stepLabel}>{it.label}</p>
            {it.detail && <p className={s.stepDetail}>{it.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SlideViewer({ slides = [], onFullscreen }) {
  const [i, setI] = useState(0);
  const n = slides.length;
  if (!n) return <p className="text-sm text-muted">No slides in this deck.</p>;
  const cur = slides[Math.min(i, n - 1)];
  const bullets = Array.isArray(cur?.bullets) ? cur.bullets
    : Array.isArray(cur?.points) ? cur.points
    : typeof cur?.body === "string" ? cur.body.split(/\n+/).filter(Boolean)
    : [];

  /**
   * How this slide is arranged.
   *
   * Named by the generator where it said so, and inferred from what the slide
   * actually holds where it did not — a deck saved before layouts existed
   * still renders, as bullets, exactly as it always did.
   */
  const layout =
    cur?.layout ||
    (cur?.items?.length ? "steps" : bullets.length ? "bullets" : cur?.note ? "statement" : "bullets");

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
      <div className={s.slide} data-layout={layout}>
        {/* A title slide and a question slide are not a heading with content
            under it — they are one thing, centred. Rendering them through the
            same header-plus-body template is what made every slide in the deck
            look identical. */}
        <p className={s.slideTitle} data-hero={layout === "title" || layout === "question"}>
          {cur?.title || `Slide ${i + 1}`}
        </p>
        <div className={s.slideBody} data-center={layout === "title" || layout === "question" || layout === "statement"}>
          {layout === "statement" && cur?.note ? (
            // The statement IS the note; printing both says it twice.
            <p className={s.statement}>{cur.note}</p>
          ) : null}
          <SlideItems layout={layout} items={cur?.items} title={cur?.title} />
          {bullets.length > 0 && (
            <ul style={{ paddingInlineStart: 18, listStyle: "disc" }}>
              {bullets.map((b, k) => <li key={k}>{typeof b === "string" ? b : b?.text}</li>)}
            </ul>
          )}
          {/* The line the class copies down. Given its own weight on the
              slide, because it is the one part of the deck that survives the
              lesson — it ends up in thirty exercise books. */}
          {cur?.note && layout !== "statement" && (
            <p className={s.slideNote}>
              <span className="font-mono uppercase tracking-wider text-[9px] block mb-1">Note</span>
              {cur.note}
            </p>
          )}
          {/* What the class is looking at. Described rather than drawn: the
              generator writes the picture, the teacher finds or sketches it. */}
          {cur?.visual && (
            <p className="text-[11.5px] text-muted mt-3 italic">
              <span className="font-mono uppercase tracking-wider text-[9px] not-italic me-1.5">Show</span>
              {cur.visual}
            </p>
          )}
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
  /**
   * Full screen is where the class actually reads the slide.
   *
   * It rendered bullets and the note and nothing else — so a slide whose whole
   * content is a drawn diagram went up on the wall as a title over empty
   * space. Same layouts as the preview, at the size they are meant to be seen.
   */
  const layout =
    cur.layout ||
    (cur.items?.length ? "steps" : bullets.length ? "bullets" : cur.note ? "statement" : "bullets");

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
        {layout === "statement" && cur.note && (
          <p className="mt-8 font-serif text-2xl md:text-4xl leading-snug text-ink max-w-[26ch]">
            {cur.note}
          </p>
        )}
        <ul className="mt-6 space-y-3 overflow-y-auto" style={{ paddingInlineStart: 22, listStyle: "disc" }}>
          {bullets.map((b, k) => (
            <li key={k} className="text-lg md:text-xl text-ink-soft leading-relaxed">
              {typeof b === "string" ? b : b?.text}
            </li>
          ))}
        </ul>
        {cur.items?.length > 0 && (
          // Scaled up rather than re-styled: the same diagram, read from the
          // back of a room instead of from a laptop.
          <div className={`mt-7 ${s.slideItemsBig}`}>
            <SlideItems layout={layout} items={cur.items} title={cur.title} />
          </div>
        )}
        {/* Projected, this is the line the class is copying — so it has to be
            on the wall, not only in the teacher's editing view. */}
        {cur.note && layout !== "statement" && (
          <p className="mt-7 text-lg md:text-2xl text-ink leading-snug border-s-4 border-accent ps-5 py-1">
            {cur.note}
          </p>
        )}
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
        /**
         * One question, two vocabularies.
         *
         * This was written against the quiz BUILDER's shape — prompt, choices,
         * correct_answer — and the generator emits question, options, answer.
         * Every field it looked for was undefined, so a freshly generated quiz
         * rendered as a column of question numbers and marks with no questions
         * in it: the teacher's words for "nothing was generated".
         *
         * Read both here rather than converting on the way in, because rows
         * already saved carry the generator's shape and would otherwise stay
         * blank forever.
         */
        const choices = Array.isArray(q.choices)
          ? q.choices
          : Array.isArray(q.options)
          ? q.options
          : [];
        const answer = q.correct_answer ?? q.answer ?? q.correct_option;
        const text = q.prompt ?? q.question ?? q.question_text ?? q.text ?? "";
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
            <p className="text-[13.5px] text-ink mt-1.5 leading-snug">{text}</p>
            {choices.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {choices.map((c, k) => {
                  const raw = typeof c === "string" ? c : c?.text ?? "";
                  const correct =
                    answer != null &&
                    (String(answer) === String(raw) ||
                      String(answer) === LETTERS[k] ||
                      // "B. 7/8" against the option "7/8", either way round
                      String(answer).replace(/^\s*[A-F][.)]\s*/i, "") ===
                        String(raw).replace(/^\s*[A-F][.)]\s*/i, "") ||
                      Number(answer) === k);
                  // The letter is already drawn in its own badge; generators
                  // that write "A. 5/3" would otherwise show it twice.
                  const label = String(raw).replace(
                    new RegExp(`^\\s*${LETTERS[k]}[.)]\\s*`, "i"),
                    "",
                  );
                  return (
                    <div key={k} className={s.choice} data-correct={correct}>
                      <span className={s.choiceKey}>{LETTERS[k]}</span>
                      <span>{label}</span>
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

/**
 * Prose artifacts — lesson plans, homework, activities.
 *
 * renderMarkdown returns React NODES, not an HTML string. Passing them
 * to dangerouslySetInnerHTML stringified the array and printed
 * "[object Object],[object Object]" where the lesson should have been —
 * and it is the safer API too, since nothing is ever injected as raw
 * HTML.
 */
export function MarkdownBody({ markdown }) {
  return <div className={s.reply}>{renderMarkdown(markdown || "")}</div>;
}
