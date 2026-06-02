// Premium brand loader. Used wherever the app shows a "we're checking
// something" state — initial auth probe on portal sign-in, slow API
// roundtrips, dashboards loading data, table sections refreshing, etc.
//
// Editorial system, not the dark-glow techy thing. Cream paper, animated
// Murchid wordmark, a single thin red accent line that sweeps left to
// right under the mark, and a JetBrains-mono-style eyebrow underneath.
//
// Three sizes via props:
//
//   <BrandLoader />                  → fullscreen (default), wordmark + bar + label
//   <BrandLoader fullscreen={false}/> → inline, same three elements without min-h-screen
//   <BrandLoader compact />          → tight, no wordmark — just sweep bar + label;
//                                      use inside cards / table sections / drawers
//
// Honors `prefers-reduced-motion` (animation stops; layout intact).
import React from "react";
import MurchidLogo from "./MurchidLogo";
import { useT } from "../lib/i18n";

export default function BrandLoader({ fullscreen = true, compact = false, label }) {
  const t = useT();
  const text = label || t("loader.label");

  const body = (
    <div className={`flex flex-col items-center ${compact ? "gap-3" : "gap-7"}`}>
      {!compact && (
        <MurchidLogo
          className="h-9 w-auto text-ink brand-loader-pulse"
          style={{ "--murchid-logo-accent": "var(--color-accent)" }}
        />
      )}
      <div className={`relative ${compact ? "w-20" : "w-32"} h-px bg-line/60 overflow-hidden`}>
        <span className={`absolute top-0 left-0 h-px ${compact ? "w-8" : "w-12"} bg-accent ${compact ? "brand-loader-sweep-compact" : "brand-loader-sweep"}`} />
      </div>
      <p
        dir="auto"
        className="font-mono text-[10px] uppercase tracking-[0.34em] text-muted brand-loader-eyebrow"
      >
        {text}
      </p>
    </div>
  );

  if (compact && !fullscreen) {
    // Compact + non-fullscreen: caller controls padding / centering.
    return <div className="flex items-center justify-center py-8">{body}</div>;
  }

  if (!fullscreen) {
    // Inline (non-fullscreen) with full elements — still padded so it
    // breathes inside whatever container hosts it.
    return <div className="flex items-center justify-center py-12">{body}</div>;
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      {body}
    </div>
  );
}
