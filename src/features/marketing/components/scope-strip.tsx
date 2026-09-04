const SYLLABI = ["CBSE", "ICSE", "IB", "State boards", "Cambridge", "and more"];

export function ScopeStrip() {
  return (
    <section className="border-y border-border/70 bg-secondary/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center md:flex-row md:justify-between md:px-8 md:text-left">
        <p className="text-sm font-medium text-foreground/60">
          Built for KG–12, any syllabus — the syllabus list is open, not a
          hardcoded few:
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          {SYLLABI.map((s, i) => (
            <span key={s} className="flex items-center gap-3 text-sm font-semibold text-foreground/80">
              {s}
              {i < SYLLABI.length - 1 ? <span className="text-foreground/25">·</span> : null}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
