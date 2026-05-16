// SlideBuilder — a Canva-lite visual deck editor. Studio hands it the
// AI's presentation markdown; it parses that into slides and lets the
// teacher edit each slide ON the slide (click a title or bullet to
// type), add / delete / reorder slides, then Save straight to
// /api/presentations. No markdown, no separate editor screen — what
// the teacher sees is the deck. Mudir editorial theme throughout.
import React, { useMemo, useState, useEffect } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Check, Presentation as DeckIcon,
} from "lucide-react";
import { api } from "./_shared";

// ── Markdown → structured deck ────────────────────────────────────
// AI output shape:
//   ## Title
//   *Subject · Grade · Section · Scheduled for*
//   ## Slide 1 — <title>
//   - bullet
//   - bullet
//   ## Speaker notes
//   - Slide 1: ...
export function parsePresentation(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  let deckTitle = "";
  let metaLine = "";
  const slides = [];
  const notesRaw = [];
  let mode = "preamble"; // preamble | slide | notes
  let cur = null;

  const flush = () => { if (cur) { slides.push(cur); cur = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      const heading = h2[1].trim();
      const slideMatch = heading.match(/^slide\s+\d+\s*[—:\-]?\s*(.*)$/i);
      if (/^speaker notes$/i.test(heading)) {
        flush();
        mode = "notes";
        continue;
      }
      if (slideMatch) {
        flush();
        cur = { title: slideMatch[1].trim() || `Slide ${slides.length + 1}`, bullets: [], notes: "" };
        mode = "slide";
        continue;
      }
      // First non-slide H2 is the deck title (## Title / ## <Topic>).
      if (mode === "preamble" && !deckTitle) {
        deckTitle = heading.replace(/^title$/i, "").trim();
        continue;
      }
      // Any other H2 once we're past preamble: treat as a slide.
      flush();
      cur = { title: heading, bullets: [], notes: "" };
      mode = "slide";
      continue;
    }

    if (mode === "preamble") {
      const m = line.match(/^\*(.+)\*$/);
      if (m) metaLine = m[1].trim();
      else if (line && !deckTitle) deckTitle = line.trim();
      continue;
    }
    if (mode === "slide" && cur) {
      const b = line.match(/^[-*]\s+(.*)$/);
      if (b) cur.bullets.push(b[1].trim());
      else if (line.trim()) cur.bullets.push(line.trim());
      continue;
    }
    if (mode === "notes" && line.trim()) {
      notesRaw.push(line.replace(/^[-*]\s+/, "").trim());
    }
  }
  flush();

  // Map "Slide N: ..." speaker-note lines back onto their slide.
  for (const n of notesRaw) {
    const m = n.match(/^slide\s+(\d+)\s*[:\-—]\s*(.*)$/i);
    if (m) {
      const idx = Number(m[1]) - 1;
      if (slides[idx]) slides[idx].notes = m[2].trim();
    }
  }

  if (slides.length === 0) {
    slides.push({ title: deckTitle || "Slide 1", bullets: [], notes: "" });
  }
  return { deckTitle: deckTitle || "Untitled presentation", metaLine, slides };
}

// Parse "Subject · Grade · Section · Scheduled for" → fields for save.
function fieldsFromMeta(metaLine) {
  const parts = String(metaLine || "").split(/·|—|\|/).map((s) => s.trim()).filter(Boolean);
  const out = { subject: "", grade: "", section: "" };
  parts.forEach((p) => {
    if (/grade/i.test(p)) out.grade = p;
    else if (/section/i.test(p)) out.section = p;
    else if (/scheduled/i.test(p)) { /* ignore — teacher sets date elsewhere */ }
    else if (!out.subject) out.subject = p;
  });
  return out;
}

export default function SlideBuilder({ markdown, presentationParams, onSaved }) {
  const initial = useMemo(() => parsePresentation(markdown), [markdown]);
  const [deckTitle, setDeckTitle] = useState(initial.deckTitle);
  const [slides, setSlides] = useState(initial.slides);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [err, setErr] = useState(null);

  // Re-seed if a fresh generation comes in (markdown changes identity).
  useEffect(() => {
    setDeckTitle(initial.deckTitle);
    setSlides(initial.slides);
    setActive(0);
    setSavedId(null);
  }, [initial]);

  const cur = slides[active] || slides[0];
  const patchSlide = (i, patch) =>
    setSlides((s) => s.map((sl, idx) => (idx === i ? { ...sl, ...patch } : sl)));

  const setBullet = (bi, val) =>
    patchSlide(active, { bullets: cur.bullets.map((b, i) => (i === bi ? val : b)) });
  const addBullet = () =>
    patchSlide(active, { bullets: [...cur.bullets, ""] });
  const removeBullet = (bi) =>
    patchSlide(active, { bullets: cur.bullets.filter((_, i) => i !== bi) });

  const addSlide = () => {
    const next = [...slides, { title: "New slide", bullets: [""], notes: "" }];
    setSlides(next);
    setActive(next.length - 1);
  };
  const deleteSlide = (i) => {
    if (slides.length === 1) return;
    const next = slides.filter((_, idx) => idx !== i);
    setSlides(next);
    setActive((a) => Math.max(0, Math.min(a, next.length - 1)));
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    setSlides(next);
    setActive(j);
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const meta = fieldsFromMeta(initial.metaLine);
      const body = {
        title: deckTitle || "Untitled presentation",
        subject: meta.subject || presentationParams?.major || "",
        grade: presentationParams?.grade || "",
        section: Array.isArray(presentationParams?.section)
          ? presentationParams.section.join(", ")
          : (presentationParams?.section || ""),
        status: "Draft",
        scheduled_for: presentationParams?.scheduled_for || null,
        slides: slides.map((s) => ({
          title: s.title,
          // Keep the manual PresentationModal's { title, body } shape —
          // body is the bullets as text. notes rides along (extra key,
          // ignored by older readers).
          body: (s.bullets || []).filter(Boolean).map((b) => `• ${b}`).join("\n"),
          notes: s.notes || "",
        })),
      };
      const saved = savedId
        ? await api(`/api/presentations/${savedId}`, { method: "PATCH", body })
        : await api("/api/presentations", { method: "POST", body });
      setSavedId(saved.id);
      onSaved?.(saved);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 rounded-lg bg-accent/[0.12] text-accent items-center justify-center flex-shrink-0">
            <DeckIcon size={14} strokeWidth={2} />
          </span>
          <input
            value={deckTitle}
            onChange={(e) => setDeckTitle(e.target.value)}
            className="font-serif text-xl md:text-2xl font-medium text-ink bg-transparent outline-none focus:border-b focus:border-line min-w-0 flex-1"
            aria-label="Deck title"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {savedId && (
            <span className="font-serif italic text-sm text-sage inline-flex items-center gap-1.5">
              <Check size={13} /> Saved
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="planner-nav-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ink text-paper-cool text-sm font-medium hover:bg-ink-soft disabled:opacity-50"
          >
            {saving ? "Saving…" : savedId ? "Save changes" : "Save to Presentations"}
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-3 bg-paper border border-accent rounded-lg p-2.5">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-5">
        {/* Thumbnail rail */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`group relative flex-shrink-0 w-[160px] lg:w-full aspect-[16/9] rounded-lg border text-left p-2 transition-all ${
                i === active
                  ? "border-accent shadow-[0_0_0_3px_rgba(200,71,43,0.12)] bg-[#fffdf6]"
                  : "border-line bg-paper-cool hover:border-ink/40"
              }`}
            >
              <span className="font-mono text-[9px] text-muted absolute top-1.5 right-2">
                {i + 1}
              </span>
              <p className="font-serif text-[11px] font-medium text-ink leading-tight line-clamp-2 pr-4">
                {s.title || "Untitled"}
              </p>
              <p className="text-[8.5px] text-muted mt-1 line-clamp-3 leading-snug">
                {(s.bullets || []).filter(Boolean).join(" · ")}
              </p>
            </button>
          ))}
          <button
            type="button"
            onClick={addSlide}
            className="flex-shrink-0 w-[160px] lg:w-full aspect-[16/9] rounded-lg border border-dashed border-line text-muted hover:border-ink hover:text-ink transition flex flex-col items-center justify-center gap-1"
          >
            <Plus size={16} />
            <span className="text-[10px] font-medium">Add slide</span>
          </button>
        </div>

        {/* Slide canvas + per-slide controls */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              Slide {active + 1} of {slides.length}
            </p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(active, -1)} disabled={active === 0}
                className="planner-nav-btn h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-paper-warm disabled:opacity-40 flex items-center justify-center" aria-label="Move slide up">
                <ChevronUp size={13} />
              </button>
              <button type="button" onClick={() => move(active, 1)} disabled={active === slides.length - 1}
                className="planner-nav-btn h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-paper-warm disabled:opacity-40 flex items-center justify-center" aria-label="Move slide down">
                <ChevronDown size={13} />
              </button>
              <button type="button" onClick={() => deleteSlide(active)} disabled={slides.length === 1}
                className="planner-nav-btn h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-accent hover:text-paper-cool hover:border-accent text-ink-soft disabled:opacity-40 flex items-center justify-center" aria-label="Delete slide">
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* The slide — 16:9, Mudir editorial. Click any text to edit. */}
          <div className="aspect-[16/9] rounded-xl border border-[#e6dccb] bg-[#fffdf6] shadow-[0_18px_44px_-22px_rgba(15,20,16,0.18)] p-8 md:p-10 flex flex-col relative overflow-hidden">
            <textarea
              value={cur?.title || ""}
              onChange={(e) => patchSlide(active, { title: e.target.value })}
              rows={1}
              className="font-serif text-2xl md:text-3xl font-semibold text-ink bg-transparent outline-none resize-none leading-tight tracking-tight focus:bg-accent/[0.04] rounded px-1 -mx-1"
              aria-label="Slide title"
            />
            <div className="mt-5 flex-1 flex flex-col gap-2 overflow-auto">
              {(cur?.bullets || []).map((b, bi) => (
                <div key={bi} className="flex items-start gap-2.5 group">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent flex-shrink-0" />
                  <textarea
                    value={b}
                    onChange={(e) => setBullet(bi, e.target.value)}
                    rows={1}
                    placeholder="Type a point…"
                    className="flex-1 text-[15px] md:text-base text-ink-soft bg-transparent outline-none resize-none leading-snug focus:bg-accent/[0.04] rounded px-1 -mx-1 placeholder:text-muted/50"
                  />
                  <button
                    type="button"
                    onClick={() => removeBullet(bi)}
                    aria-label="Remove point"
                    className="opacity-0 group-hover:opacity-100 transition mt-1 h-5 w-5 rounded text-muted hover:text-accent flex items-center justify-center flex-shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addBullet}
                className="self-start inline-flex items-center gap-1.5 text-[12px] text-accent hover:text-ink font-serif italic mt-1"
              >
                <Plus size={12} /> Add a point
              </button>
            </div>
            <span className="absolute bottom-4 right-5 font-mono text-[10px] text-muted/70">
              {active + 1} / {slides.length}
            </span>
          </div>

          {/* Speaker notes for this slide */}
          <div className="mt-3">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted mb-1.5">
              Speaker notes
            </p>
            <textarea
              value={cur?.notes || ""}
              onChange={(e) => patchSlide(active, { notes: e.target.value })}
              rows={2}
              placeholder="What you'll say while this slide is up (optional)…"
              className="w-full rounded-lg border border-line bg-paper-cool px-3 py-2 text-[13px] text-ink outline-none focus:border-ink resize-none placeholder:text-muted/60"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
