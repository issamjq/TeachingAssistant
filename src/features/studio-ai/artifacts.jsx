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
import React, { useEffect, useRef, useState } from "react";
import {
  FileText, GraduationCap, ClipboardList, Layers, Puzzle,
  ChevronLeft, ChevronRight, Maximize2, X, Check,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { renderMarkdown } from "@/lib/markdown";
import s from "./Studio.module.css";
import { deckToneIndex } from "./deckTheme";

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
/* ══ Pictures on the slides ═══════════════════════════════════════════
   A deck of coloured text boxes is not what a teacher means by a
   presentation. Every teaching slide already carries a "Show:" cue — a
   plain description of what the class should be looking at — and until
   now that description was printed in a frame, honestly labelled, for
   the teacher to go and find the picture herself.

   She should not have to. The cue is already a search query, and the
   backend already proxies Openverse: no API key, openly licensed, and
   attribution returned with every result, which is what a school
   projecting to a class and archiving the deck actually needs.

   Resolved per slide, on the slide she is looking at, so a fourteen-slide
   deck does not fire fourteen searches to show one picture. Cached across
   the whole session because the same deck asks for the same few terms
   repeatedly, and failures are cached too — a term Openverse has nothing
   for must not be retried on every render.
   ═══════════════════════════════════════════════════════════════════ */

const PHOTO_CACHE = new Map();

/**
 * A searchable query from a described picture.
 *
 * The cues are written for a person — "A map with one factory pipe marked
 * in red versus a whole farming valley shaded in arrows" — and handing
 * that to an image search returns nothing. The nouns are what matches, so
 * the instruction words are dropped and the first few content words kept.
 */
function photoQuery(visual, title) {
  /**
   * The TITLE first, then the cue.
   *
   * Built from the cue alone this produced "three-step arrow warm
   * rising" — every word present in the sentence and none of them the
   * subject — and Openverse rightly returned nothing. The cue describes
   * the drawing; the title names the thing. "From Vapour to Cloud"
   * reduces to "vapour cloud", which finds a photograph of exactly
   * that.
   *
   * The cue still contributes, after the title, so a slide whose title
   * is vague ("What you will need") can still be matched on what it
   * actually shows.
   */
  const text = `${String(title || "")} ${String(visual || "")}`.toLowerCase();
  const stop = new Set([
    "a","an","the","of","and","or","with","in","on","at","to","for","from","by",
    "one","two","three","four","showing","show","shows","diagram","picture","photo",
    "image","labelled","labeled","marked","versus","vs","side","that","this","its",
    "into","over","under","above","below","up","down","out","is","are","be","being",
    "each","every","some","any","their","there","where","which","what","how","then",
  ]);
  const seen = new Set();
  const words = text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w))
    .filter((w) => (seen.has(w) ? false : seen.add(w)));
  // Three words. Openverse narrows hard on a fourth, and an empty result
  // is worse than a loosely-related photograph.
  return words.slice(0, 3).join(" ").trim();
}

function useSlideImage(visual, title, active) {
  const [photo, setPhoto] = useState(null);
  const query = active ? photoQuery(visual, title) : "";

  useEffect(() => {
    if (!query) return;
    if (PHOTO_CACHE.has(query)) {
      setPhoto(PHOTO_CACHE.get(query));
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { api } = await import("@/shared/lib/apiClient");
        const res = await api(`/api/images/search?q=${encodeURIComponent(query)}&per_page=3`);
        const found = res?.photos?.[0] || null;
        PHOTO_CACHE.set(query, found);
        if (alive) setPhoto(found);
      } catch {
        // A deck without a photograph is still a deck. Remember the miss so
        // a dead term is not asked for again on every re-render.
        PHOTO_CACHE.set(query, null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [query]);

  return photo;
}

export function slidesFromMarkdown(markdown) {
  const text = String(markdown || "");
  if (!text.trim()) return [];

  const cue = (block, name) => {
    const m = block.match(
      new RegExp(`^>\\s*\\*{0,2}${name}:?\\*{0,2}\\s*(.+(?:\\n(?!>).*)*)`, "im"),
    );
    if (!m) return "";
    /**
     * A cue runs on until the next quoted line, which means it also
     * swallows the "---" that ends the slide when the deck was split on
     * its headings rather than on its rules. The teacher then reads
     * "Science · Grade 9 ---" on the cover, with the separator printed
     * as if it were part of her subtitle.
     */
    return m[1]
      .replace(/\n>?\s*/g, " ")
      .replace(/\*\*/g, "")
      .replace(/\s*-{3,}\s*$/, "")
      .trim();
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
  const byTitle = text.split(/\n(?=\s*#{1,3}\s+)/);
  /**
   * Whichever finds MORE slides is the one that read the deck correctly.
   *
   * The rule split needs "---" alone on its line, and a generator that ran it
   * onto the end of the line above — "...and oxygen. --- Plants make their
   * own food" — hides it. That is not a rule the parser can see, so eight
   * slides arrived as three, each carrying two or three slides' worth of
   * bullets, and the deck looked both empty and overfull at once.
   *
   * Every slide carries exactly one title, so the titles are the second, and
   * more reliable, count of them. Taking the larger of the two keeps the old
   * behaviour where the rules are written properly (both agree), still reads
   * a deck written with no rules at all, and recovers the case where SOME of
   * the rules were swallowed — which is the one that was silently losing
   * five slides out of eight.
   */
  const blocks = byTitle.length > byRule.length ? byTitle : byRule;

  return blocks
    .map((block) => {
      // A heading carrying "::" is an item that landed where a title goes; the
      // half before it is still the name of the thing.
      const rawTitle =
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

      /**
       * "Slide 1" is a position, not a title.
       *
       * The instruction spells out `never "Slide 4"` and a small model copied
       * the placeholder wholesale anyway — a deck whose every heading read
       * "Slide 1", "Slide 2", "Slide 3" and therefore said nothing from the
       * back of a room. Rather than print it, the slide is named from what it
       * actually carries: the first thing in its diagram, or its first bullet.
       * That is the slide's own content, not an invention.
       */
      const unnamed = !rawTitle || /^(slide|page)\s*\d*$/i.test(rawTitle);
      const title = unnamed
        ? (items[0]?.label || bullets[0] || "").split(/[.;:]/)[0].trim().slice(0, 60)
        : rawTitle;

      // A bullet promoted to the heading does not also stay a bullet: printing
      // it twice, once large and once small, is the repair showing its working.
      const shown =
        unnamed && title && !items.length && bullets[0]?.startsWith(title)
          ? bullets.slice(1)
          : bullets;

      /**
       * The deck's colour, and this slide's one-word tag.
       *
       * Both are plain "Key: value" lines rather than cues, because they sit
       * beside "Layout:" and are read the same way. Theme is written on the
       * first slide only; a deck that predates the field simply has none and
       * falls back to the old behaviour.
       */
      const theme = (block.match(/^\s*Theme:\s*([a-z]+)\s*$/im)?.[1] || "").toLowerCase();
      /**
       * Found anywhere, not only at the start of a line.
       *
       * The format puts Tag on its own line under Layout, and the writer
       * routinely puts both on one — "Layout: title Tag: TOPIC". Anchoring
       * to the line start read that as no tag at all, which is a silent
       * miss: the deck renders, just without the label the design depends
       * on. One word, so it cannot swallow the rest of the line.
       */
      const tag = (block.match(/(?:^|\s)Tag:\s*([A-Za-z][A-Za-z-]{0,18})\b/m)?.[1] || "")
        .trim()
        .toUpperCase();

      return {
        title,
        // What it says it is; failing that, what it looks like.
        layout: layout || (items.length ? "steps" : bullets.length ? "bullets" : "statement"),
        bullets: shown,
        items,
        ...(theme ? { theme } : {}),
        ...(tag ? { tag } : {}),
        note: cue(block, "Note"),
        visual: cue(block, "Show"),
        notes: cue(block, "Say"),
        onScreen: cue(block, "On screen"),
        pause: cue(block, "Pause"),
        source: cue(block, "Source"),
      };
    })
    // A block with no title and no bullets is the preamble before slide one,
    // not a slide.
    .filter((x) => x.title || x.bullets.length || x.items.length);
}

/**
 * The same repair, for a deck that came back from the structured pass.
 *
 * The viewer prefers structured slides over the markdown, so repairing only
 * the parser would have fixed the deck nobody sees. The structured pass reads
 * the same markdown, so it inherits the same "Slide 1" headings.
 */
export function namedSlides(slides) {
  if (!Array.isArray(slides)) return slides;
  return slides.map((slide) => {
    const title = String(slide?.title || "").trim();
    if (title && !/^(slide|page)\s*\d*$/i.test(title)) return slide;
    const named = String(slide?.items?.[0]?.label || slide?.bullets?.[0] || "")
      .split(/[.;:]/)[0]
      .trim()
      .slice(0, 60);
    if (!named) return slide;
    const promoted =
      !slide?.items?.length && slide?.bullets?.[0]?.startsWith(named);
    return { ...slide, title: named, ...(promoted ? { bullets: slide.bullets.slice(1) } : {}) };
  });
}

/**
 * Bold, drawn rather than spelled.
 *
 * Slide text arrives from two places: markdown, where the parser strips the
 * asterisks, and the structured pass, where it does not — so the note under a
 * diagram went on the classroom wall reading "The **water cycle** has four
 * stages". Emphasis is the generator naming the key term, which is worth
 * keeping on a slide, so it is rendered instead of removed.
 */
function Rich({ text }) {
  const value = String(text ?? "");
  if (!value.includes("**")) return value;
  return value.split(/\*\*(.+?)\*\*/g).map((part, k) =>
    k % 2 ? <strong key={k} className="font-semibold">{part}</strong> : part,
  );
}

/**
 * A quiz paper, read back into questions.
 *
 * The paper is written as Markdown and the Markdown IS the quiz. A second
 * model call used to read it back as JSON purely so the viewer could have
 * fields — about half the cost of every quiz, spent re-typing a document that
 * was already correct.
 *
 * The format is the one the generator is instructed to write, so it is a
 * parser's job: numbered questions carrying their marks, lettered options
 * under the ones that have them, and a mark scheme after the rule. Nothing
 * about the generation changes; only who does the reading.
 */
/**
 * The teacher's half of the paper.
 *
 * questionsFromMarkdown() splits the paper from the mark scheme and keeps
 * only the paper, and QuizViewer renders only questions — so everything
 * after the rule was parsed off and shown to nobody. The answers, the
 * partial-credit notes and the table saying which skill each question
 * tested were all generated, paid for, and then dropped on the floor.
 *
 * Returns the scheme as Markdown, or "" when the paper has none.
 */
export function markSchemeFromMarkdown(markdown) {
  const parts = String(markdown || "").split(/\n-{3,}\s*\n+#+\s*Mark scheme\s*\n/i);
  return parts[1] ? parts[1].trim() : "";
}

export function questionsFromMarkdown(markdown) {
  const text = String(markdown || "");
  if (!text.trim()) return [];

  // The paper, and the mark scheme that follows it.
  const split = text.split(/\n-{3,}\s*\n+#+\s*Mark scheme\s*\n/i);
  const paper = split[0] || text;
  const scheme = split[1] || "";

  /** "**3.** B. 1/4 — (1 mark) for…" → { 3: "B. 1/4 — …" } */
  const answers = {};
  for (const m of scheme.matchAll(/^\*\*(\d{1,2})\.\*\*\s*([\s\S]*?)(?=\n\*\*\d{1,2}\.\*\*|$)/gm)) {
    answers[Number(m[1])] = String(m[2] || "").trim();
  }

  const out = [];
  // A question opens on a numbered line and runs until the next one.
  // `(?![\s\S])` rather than `$`: under the m flag `$` is end of LINE, so a
  // question block stopped at its own first line and every lettered option
  // under it was lost.
  const blocks = [
    ...paper.matchAll(/^(\d{1,2})\.\s+([\s\S]*?)(?=\n\d{1,2}\.\s+|\n##\s|(?![\s\S]))/gm),
  ];

  for (const b of blocks) {
    const position = Number(b[1]);
    const body = String(b[2] || "");

    const marks = Number(body.match(/\*\*\((\d{1,2})\s*marks?\)\*\*/i)?.[1] ?? 0) || null;

    // Lettered options, each on its own line.
    const choices = [...body.matchAll(/^\s*([A-F])[.)]\s+(.+)$/gm)].map((c) => c[2].trim());

    // Everything before the first option and before the answer space.
    const prompt = body
      .split(/\n\s*[A-F][.)]\s+/)[0]
      .replace(/\*\*\(\d{1,2}\s*marks?\)\*\*/i, "")
      .replace(/\*\*Answer:\*\*[\s\S]*$/i, "")
      .replace(/^>\s.*$/gm, "")
      .replace(/_{4,}/g, "")
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!prompt) continue;

    const raw = answers[position] || "";
    // The answer line is the first line of its scheme entry, minus the
    // marking notes that follow the dash.
    const correct_answer = raw
      .split(/\n/)[0]
      .replace(/—\s*\*\*\(\d+\s*marks?\)\*\*[\s\S]*$/i, "")
      .replace(/\*\*/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const looksTrueFalse = /\btrue\b[\s\S]{0,12}\bfalse\b/i.test(choices.join(" "));
    const type = choices.length
      ? looksTrueFalse
        ? "true_false"
        : "mcq"
      : (marks ?? 0) >= 3
        ? "essay"
        : "short";

    out.push({
      position,
      type,
      prompt,
      ...(choices.length ? { choices } : {}),
      ...(correct_answer ? { correct_answer } : {}),
      ...(marks ? { marks } : {}),
    });
  }

  return out;
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
/**
 * One piece of slide text, editable where the caller can take a change.
 *
 * The editor and the viewer draw slides with the same component so the two
 * cannot drift — the teacher edits the thing she was shown. Read-only it is
 * the text; editable it is the text with a caret in it, and nothing about the
 * layout around it changes.
 */
function T({ v, edit, className, style }) {
  if (!edit) return <Rich text={v} />;
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      className={`outline-none focus:bg-black/[0.05] rounded-[3px] px-0.5 -mx-0.5 ${className || ""}`}
      style={style}
      onBlur={(e) => edit(e.currentTarget.innerText.replace(/\s+/g, " ").trim())}
      dangerouslySetInnerHTML={{ __html: String(v ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])) }}
    />
  );
}

export function SlideItems({ layout, items, title, visual, index = 0, edit }) {
  const on = (i, k) => (edit ? (v) => edit(i, k, v) : null);
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
    return <p className={s.statement}><Rich text={items[0].detail} /></p>;
  }

  if (layout === "stat") {
    const [first] = items;
    return (
      <div className={s.statWrap}>
        <p className={s.statNumber}><T v={first.label} edit={on(0, "label")} /></p>
        {first.detail && <p className={s.statCaption}><Rich text={first.detail} /></p>}
      </div>
    );
  }

  if (layout === "compare") {
    return (
      <div className={s.compareWrap} data-cols={items.length}>
        {items.map((it, i) => (
          <div key={i} className={s.compareCol}>
            <p className={s.compareLabel}><T v={it.label} edit={on(i, "label")} /></p>
            {(it.detail || edit) && <p className={s.compareDetail}><T v={it.detail} edit={on(i, "detail")} /></p>}
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
            <p className={s.cycleLabel}><T v={it.label} edit={on(i, "label")} /></p>
            {(it.detail || edit) && <p className={s.cycleDetail}><T v={it.detail} edit={on(i, "detail")} /></p>}
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

  /**
   * A vocabulary word, given the whole slide.
   *
   * The single most common teaching slide there is, and the one a bulleted
   * list serves worst: the term is the thing being learned, so it is set at
   * the size of a headline with its meaning beneath, not as the bold half of
   * a bullet point.
   */
  /**
   * A labelled visual on one side, the words on the other.
   *
   * The layout every real teaching deck is mostly made of, and the one this
   * format did not have: everything stacked vertically, which is why a slide
   * read like a page of a document rather than something on a wall. The side
   * the visual sits on alternates down the deck, so consecutive slides do not
   * land in the same shape.
   */
  if (layout === "split") {
    const flip = index % 2 === 1;
    return (
      <div className={s.splitWrap} data-flip={flip ? "true" : "false"}>
        <div className={s.splitText}>
          {items.map((it, i) => (
            <div key={i} className={s.splitPoint}>
              <p className={s.splitLabel}><T v={it.label} edit={on(i, "label")} /></p>
              {(it.detail || edit) && <p className={s.splitDetail}><T v={it.detail} edit={on(i, "detail")} /></p>}
            </div>
          ))}
        </div>
        {visual && <SplitVisual visual={visual} title={title} />}
      </div>
    );
  }

  /**
 * The picture beside the words.
 *
 * A real photograph when one is found, and the described cue when one is
 * not — the caption was the old behaviour and it is still the right
 * fallback, because a slide that silently loses its visual is worse than
 * one that tells the teacher what to draw.
 */
function SplitVisual({ visual, title }) {
  const photo = useSlideImage(visual, title, true);
  if (!photo) {
    return (
      <figure className={s.splitVisual}>
        <span className={s.splitVisualTag}>Show</span>
        <figcaption className={s.splitVisualText}>{visual}</figcaption>
      </figure>
    );
  }
  return (
    <figure className={s.splitPhoto}>
      <img src={photo.thumb || photo.full} alt={photo.alt || visual} loading="lazy" />
      {/* Openly licensed, and the licence says to say so. */}
      <figcaption className={s.photoCredit}>{photo.credit}</figcaption>
    </figure>
  );
}

/** What they will be able to do by the end — numbered, near the front. */
  if (layout === "objectives") {
    // The card is already numbered, so a label that is only "One" or "1" is
    // the same word twice. Where the generator counted instead of naming the
    // objective, the sentence it wrote is the objective.
    const ordinal = /^(one|two|three|four|five|six|\d+)[.)]?$/i;
    return (
      <div className={s.objWrap}>
        {items.map((it, i) => {
          const counted = ordinal.test(String(it.label || "").trim());
          const heading = counted ? "" : it.label;
          const body = counted ? it.label && it.detail : it.detail;
          return (
            <div key={i} className={s.objCard}>
              <span className={s.objNum}>{["One", "Two", "Three", "Four", "Five", "Six"][i] || i + 1}</span>
              {heading && <p className={s.objLabel}>{heading}</p>}
              {(counted ? it.detail : it.detail) && (
                <p className={heading ? s.objDetail : s.objLabel}>
                  <Rich text={it.detail} />
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (layout === "term") {
    const [first] = items;
    return (
      <div className={s.termWrap}>
        <p className={s.termWord}><T v={first.label} edit={on(0, "label")} /></p>
        {first.detail && <p className={s.termMeaning}><Rich text={first.detail} /></p>}
        {items.slice(1).map((it, i) => (
          <p key={i} className={s.termAlso}>
            <strong>{it.label}</strong> <Rich text={it.detail} />
          </p>
        ))}
      </div>
    );
  }

  /** Milestones against time — dates, weeks, periods of history. */
  if (layout === "timeline") {
    return (
      <div className={s.timelineWrap}>
        {items.map((it, i) => (
          <div key={i} className={s.timelineRow}>
            <span className={s.timelineWhen}><T v={it.label} edit={on(i, "label")} /></span>
            <span className={s.timelineDot} aria-hidden="true" />
            <p className={s.timelineWhat}><Rich text={it.detail} /></p>
          </div>
        ))}
      </div>
    );
  }

  /** Success criteria, instructions, a do-now — things to be ticked off. */
  if (layout === "checklist") {
    return (
      <div className={s.checkWrap}>
        {items.map((it, i) => (
          <div key={i} className={s.checkRow}>
            <span className={s.checkBox} aria-hidden="true" />
            <div>
              <p className={s.checkLabel}><T v={it.label} edit={on(i, "label")} /></p>
              {(it.detail || edit) && <p className={s.checkDetail}><T v={it.detail} edit={on(i, "detail")} /></p>}
            </div>
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
            <p className={s.partLabel}><T v={it.label} edit={on(i, "label")} /></p>
            {(it.detail || edit) && <p className={s.partDetail}><T v={it.detail} edit={on(i, "detail")} /></p>}
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
            <p className={s.stepLabel}><T v={it.label} edit={on(i, "label")} /></p>
            {(it.detail || edit) && <p className={s.stepDetail}><T v={it.detail} edit={on(i, "detail")} /></p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Content scaled to the slide it is on, so nothing is ever cut off.
 *
 * Projected, a slide cannot scroll — a class cannot reach the scrollbar and a
 * teacher mid-sentence should not have to. A dense slide was simply losing its
 * last card off the bottom of the frame. Rather than capping how much a slide
 * may carry, what is on it is measured and shrunk to fit: full size when it
 * fits, a little smaller when it does not, which is what a designer would do
 * with the same content.
 */
function FitToBox({ children, className = "" }) {
  const box = useRef(null);
  const inner = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => {
      const b = box.current;
      const el = inner.current;
      if (!b || !el) return;
      el.style.transform = "scale(1)";
      const h = el.scrollHeight;
      const w = el.scrollWidth;
      const available = b.clientHeight;
      const across = b.clientWidth;
      if (!h || !available) return;
      // 0.55 floor: below that the text is too small to read from the back,
      // and the honest answer is that the slide is overfull.
      const next = Math.max(0.55, Math.min(1, Math.min(available / h, across / w)));
      setScale(next);
      el.style.transform = "";
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    if (inner.current) ro.observe(inner.current);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [children]);

  return (
    <div ref={box} className={`${s.fitBox} ${className}`}>
      <div ref={inner} className={s.fitInner} style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
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
      {/* `cur.tone` is a colour the teacher chose on this slide; without one
          the deck's own tone applies. */}
      <div
        className={s.slide}
        data-layout={layout}
        data-tone={deckToneIndex(slides)}
        style={cur?.tone}
        data-themed={cur?.tone ? "true" : undefined}
      >
        {/* A title slide and a question slide are not a heading with content
            under it — they are one thing, centred. Rendering them through the
            same header-plus-body template is what made every slide in the deck
            look identical. */}
        {/*
            The eyebrow: "04 / CAUSES".

            Small, above the title, in the deck's accent. It gives a class
            two things before they read a word of content — where they are
            in the deck, and what kind of moment this is. Skipped on the
            opening and closing slides, which are one thing on a field and
            have no "where are we" to answer.
        */}
        {cur?.tag && layout !== "title" ? (
          <p className={s.slideTag}>
            {String(i + 1).padStart(2, "0")} <span aria-hidden="true">/</span> {cur.tag}
          </p>
        ) : null}
        <p className={s.slideTitle} data-hero={layout === "title" || layout === "question"}>
          {cur?.title || `Slide ${i + 1}`}
        </p>
        <div className={s.slideBody} data-center={layout === "title" || layout === "question" || layout === "statement"}>
          {layout === "statement" && cur?.note ? (
            // The statement IS the note; printing both says it twice.
            <p className={s.statement}><Rich text={cur.note} /></p>
          ) : null}
          <SlideItems layout={layout} items={cur?.items} title={cur?.title} visual={cur?.visual} index={i} />
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
              <Rich text={cur.note} />
            </p>
          )}
          {/* What the class is looking at. Described rather than drawn: the
              generator writes the picture, the teacher finds or sketches it. */}
          {cur?.visual && layout !== "split" && (
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

  /** Layouts that are one thing, centred — not a heading with content under it. */
  const hero =
    (layout === "title" || layout === "question" || layout === "statement") &&
    !cur.items?.length &&
    !bullets.length;

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
      {/*
        Projected, a slide is not a document with a heading on it.
        
        A title and a question carry one thing each and were being rendered
        through the same header-then-body template as a diagram slide: a
        modest heading in the top-left of a very large empty box, which is
        why a deck on the wall looked like it had lost its content. Those
        layouts are set centred and large; everything else keeps the header,
        gains a rule under it, and is allowed to scroll rather than being
        clipped by the frame.
      */}
      <div
        className={`${s.slide} ${s.fullFrame} w-full max-w-5xl aspect-[16/9] rounded-2xl p-10 md:p-16 flex flex-col overflow-hidden`}
        data-layout={layout}
        data-tone={deckToneIndex(slides)}
        style={cur?.tone}
        data-themed={cur?.tone ? "true" : undefined}
      >
        <FitToBox className={hero ? s.fitCentre : ""}>
        <h2
          className={`${s.fullTitle} ${
            hero
              ? "font-serif text-4xl md:text-6xl font-semibold leading-[1.08] max-w-[20ch]"
              : "font-serif text-3xl md:text-5xl font-semibold leading-tight shrink-0"
          }`}
        >
          {cur.title || `Slide ${i + 1}`}
        </h2>

        {/* One accent rule, the whole deck's identity. */}
        <span
          aria-hidden
          className={`${s.fullRule} block h-[3px] rounded shrink-0 ${hero ? "mt-7 w-24" : "mt-4 w-16"}`}
        />

        {/* On a hero slide the note IS the slide — the definition the class
            copies, set at reading size for the back of the room. */}
        {hero && cur.note && (
          <p className="mt-9 font-serif text-2xl md:text-4xl leading-snug text-ink max-w-[28ch]">
            <Rich text={cur.note} />
          </p>
        )}

        {!hero && (
          <>
            {bullets.length > 0 && (
              <ul className="mt-7 space-y-3" style={{ paddingInlineStart: 22, listStyle: "disc" }}>
                {bullets.map((b, k) => (
                  <li key={k} className="text-lg md:text-2xl text-ink-soft leading-relaxed">
                    {typeof b === "string" ? b : b?.text}
                  </li>
                ))}
              </ul>
            )}
            {cur.items?.length > 0 && (
              // Scaled up rather than re-styled: the same diagram, read from the
              // back of a room instead of from a laptop.
              <div className={`mt-8 ${s.slideItemsBig}`}>
                <SlideItems layout={layout} items={cur.items} title={cur.title} visual={cur.visual} index={i} />
              </div>
            )}
            {/* Projected, this is the line the class is copying — so it has to
                be on the wall, not only in the teacher's editing view. */}
            {cur.note && (
              <p className="mt-8 text-xl md:text-3xl text-ink leading-snug border-s-4 border-accent ps-6 py-1">
                <Rich text={cur.note} />
              </p>
            )}
          </>
        )}
        </FitToBox>
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
