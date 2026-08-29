"use client";

// =====================================================================
// The shape of the document that is coming
//
// The gap between pressing send and the first token is several seconds,
// and it used to be three bouncing dots. Dots say "something", not "your
// lesson plan is on its way" — which is why teachers read the wait as a
// hang and pressed the button again.
//
// A skeleton says both. It is the document's own shape — heading, a
// couple of lines, the table of key words every lesson opens with — so
// the wait looks like the thing arriving rather than like nothing
// happening. When the first token lands this is replaced by real text in
// the same place, at the same width, and nothing jumps.
//
// Deliberately not a progress bar. The one honest thing to show before
// any output exists is what is being made, and the answer to "how far in
// is it" is "it has not started". A number here would have to be a timer
// dressed as progress.
// =====================================================================
import { Sparkles } from "lucide-react";

import { KIND_META } from "./artifacts";

import s from "./Studio.module.css";

/** A shimmering block. Width is a percentage so lines look like prose. */
function Line({ w = "100%", h = 10, className = "", style }) {
  return (
    <span
      className={`${s.skelBlock} ${className}`}
      style={{ width: w, height: h, ...style }}
      aria-hidden="true"
    />
  );
}

/**
 * @param {object} props
 * @param {string} [props.kind]   What is being written, when known.
 * @param {string} [props.stage]  Service stage before any prose ("planning").
 */
export default function DocumentSkeleton({ kind, stage }) {
  const label = kind ? KIND_META[kind]?.label : null;

  return (
    <div className={s.skel} role="status" aria-live="polite">
      <span className="sr-only">
        {stage === "planning"
          ? "Reading the brief"
          : `Writing${label ? ` the ${label.toLowerCase()}` : ""}`}
      </span>

      {/* The one line of words. Before any prose exists the service is
          reading the brief, and saying so is more use than "loading". */}
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted mb-3">
        {stage === "planning"
          ? "Reading the brief"
          : label
            ? `Writing the ${label.toLowerCase()}`
            : "Writing"}
      </p>

      {/* Title */}
      <Line w="58%" h={16} />

      {/* Metadata line under it */}
      <Line w="30%" h={9} className="mt-2.5" />

      {/* A short paragraph */}
      <div className="mt-5 flex flex-col gap-2">
        <Line w="94%" />
        <Line w="88%" />
        <Line w="70%" />
      </div>

      {/* The table every lesson and quiz opens with */}
      <div className="mt-5 rounded-lg border border-line overflow-hidden">
        {[0, 1, 2].map((r) => (
          <div
            key={r}
            className="flex gap-3 px-3 py-2.5"
            style={{ borderTop: r ? "1px solid var(--p-line)" : undefined }}
          >
            <Line w="26%" h={9} />
            <Line w="60%" h={9} />
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Line w="91%" />
        <Line w="64%" />
      </div>
    </div>
  );
}


// =====================================================================
// The two waits either side of a generation
//
// The document skeleton above covers the wait a teacher causes. These
// cover the two she does not: the conversation list arriving on first
// paint, and an older thread being reopened. Both used to show nothing
// at all — and the list was worse than nothing, because an empty array
// is indistinguishable from an unfetched one, so a teacher with twenty
// conversations was told "Nothing yet" for as long as the query took.
// =====================================================================

/**
 * Rows in the shape of the rail's own items, for the moment before
 * `listSessions()` answers.
 *
 * Rendered INTO the existing `.railList`, not around it, so the padding
 * and the scroll behaviour stay defined in one place.
 */
export function ConversationListSkeleton({ rows = 5 }) {
  // Varied widths: five identical bars read as a graphic, uneven ones
  // read as titles that have not arrived yet.
  const widths = ["86%", "68%", "91%", "60%", "79%"];

  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading your conversations</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={s.railItem} aria-hidden="true">
          <span className={s.railOpen}>
            <Line w="13px" h={13} className="flex-shrink-0 mt-0.5 self-start" />
            <span className={s.railItemText}>
              <Line w={widths[i % widths.length]} h={11} />
              <Line w="34%" h={8} className="mt-1.5" />
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A conversation being reopened.
 *
 * Without this the thread kept showing the PREVIOUS conversation until
 * the new one landed — which is not a slow load, it is the wrong answer
 * displayed confidently. One question and one document is enough shape
 * to read as "a conversation is coming"; guessing at the real length
 * would only make the swap jump further.
 */
export function ThreadSkeleton() {
  return (
    <div className={s.threadInner} role="status" aria-live="polite">
      <span className="sr-only">Opening the conversation</span>

      {/* What she asked, as a bubble on her side. */}
      <div className={s.turn} data-role="user" aria-hidden="true">
        <div>
          <Line w="240px" h={36} style={{ borderRadius: 14 }} />
        </div>
      </div>

      {/* What came back. The same card the real document arrives in. */}
      <div className={s.turn} aria-hidden="true">
        <span className={s.avatar}><Sparkles size={15} /></span>
        <div className="flex-1 min-w-0">
          <div className={s.skel}>
            <Line w="52%" h={16} />
            <Line w="28%" h={9} className="mt-2.5" />
            <div className="mt-5 flex flex-col gap-2">
              <Line w="95%" />
              <Line w="89%" />
              <Line w="73%" />
              <Line w="84%" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
