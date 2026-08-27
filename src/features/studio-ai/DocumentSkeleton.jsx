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
import { KIND_META } from "./artifacts";

import s from "./Studio.module.css";

/** A shimmering block. Width is a percentage so lines look like prose. */
function Line({ w = "100%", h = 10, className = "" }) {
  return (
    <span
      className={`${s.skelBlock} ${className}`}
      style={{ width: w, height: h }}
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
