// Premium brand loader. Used wherever the app shows a full-screen
// "we're checking something" state (initial auth probe on the portal
// sign-in pages, slow API roundtrips, etc.).
//
// Editorial system, not the dark-glow techy thing. Cream paper, animated
// Murchid wordmark, a single thin red accent line that sweeps left to
// right under the mark, and a JetBrains-mono-style eyebrow underneath.
//
// Honors `prefers-reduced-motion` (animation stops; the elements still
// render so layout doesn't shift).
import React from "react";
import MurchidLogo from "./MurchidLogo";
import { useT } from "../lib/i18n";

export default function BrandLoader({ fullscreen = true, label }) {
  const t = useT();
  const text = label || t("loader.label");

  const body = (
    <div className="flex flex-col items-center gap-7">
      <MurchidLogo
        className="h-9 w-auto text-ink brand-loader-pulse"
        style={{ "--murchid-logo-accent": "var(--color-accent)" }}
      />
      <div className="relative w-32 h-px bg-line/60 overflow-hidden">
        <span className="absolute top-0 left-0 h-px w-12 bg-accent brand-loader-sweep" />
      </div>
      <p
        dir="auto"
        className="font-mono text-[10px] uppercase tracking-[0.34em] text-muted brand-loader-eyebrow"
      >
        {text}
      </p>
    </div>
  );

  if (!fullscreen) return body;

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      {body}
    </div>
  );
}
