"use client";

import { useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";

// Placeholder for nav sections that are routable but not built yet.
// Lifted from App.jsx's final `else` branch.
export default function ComingSoon({
  section,
  label,
}: {
  section: string;
  label?: string;
}) {
  const t = useT();
  const key = `nav.${section}` as TranslationKey;
  const translated = t(key);
  const heading = translated === `nav.${section}` ? (label ?? section) : translated;

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3 inline-flex items-center gap-2.5">
        <span className="w-6 h-px bg-accent" /> {heading}
      </p>
      <h2 className="font-serif text-5xl font-medium text-ink mb-3">
        Coming <em className="italic font-light text-accent">soon</em>
      </h2>
    </div>
  );
}
