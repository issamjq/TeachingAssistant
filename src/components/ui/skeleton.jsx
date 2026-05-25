import React from "react";

// Murchid skeleton — warm, low-contrast placeholder that pulses while a
// page loads its data. Replaces the bare "Loading…" text labels. The
// pulse is disabled under prefers-reduced-motion (motion-reduce variant).

export function Skeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse motion-reduce:animate-none rounded-md bg-ink/[0.07] ${className}`}
    />
  );
}

// A single list-row placeholder: a rounded icon tile + two text lines,
// mirroring the shape of the real list rows so the layout doesn't jump
// when content arrives.
export function SkeletonRow({ className = "" }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-line/60 bg-paper-cool/60 px-4 py-3.5 ${className}`}>
      <Skeleton className="h-10 w-10 flex-shrink-0 rounded-lg" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-2.5 w-2/3" />
      </div>
      <Skeleton className="h-6 w-16 flex-shrink-0 rounded-full" />
    </div>
  );
}

// A stack of row placeholders. `count` rows, staggered so the pulse reads
// as one surface settling in rather than a flat block.
export function SkeletonList({ count = 5, className = "" }) {
  return (
    <div role="status" aria-busy="true" className={`space-y-2.5 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// A card-grid placeholder for list pages that render tiles (e.g.
// templates, presentations) rather than rows.
export function SkeletonCards({ count = 6, className = "" }) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line/60 bg-paper-cool/60 p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
