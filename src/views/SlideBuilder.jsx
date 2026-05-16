// SlideBuilder — a "smart deck" editor (Gamma/Pitch style) plus a
// read-only presenter. Used in two places:
//   • Studio  — pass `markdown` (the AI output) to author a fresh deck.
//   • Presentations chip — pass `deck` + `presentationId` + `meta` to
//     re-open a saved deck for editing; `PresentDeck` renders it full
//     screen for teaching.
// Photos are always real (Pexels search or the teacher's own upload),
// never AI. Mudir editorial theme throughout.
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Check, Image as ImageIcon,
  Search, Upload, X, Sparkles, Presentation as DeckIcon, Loader2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { api } from "./_shared";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const resolveSrc = (u) =>
  !u ? "" : /^https?:\/\//.test(u) ? u : API_BASE + u;

// ── Background themes ─────────────────────────────────────────────
const THEMES = {
  paper:  { name: "Paper",  bg: "#fffdf6", text: "#1a1814", soft: "#6b6051", dot: "#c8472b" },
  white:  { name: "White",  bg: "#ffffff", text: "#1a1814", soft: "#6b6051", dot: "#c8472b" },
  sand:   { name: "Sand",   bg: "#f1e7d0", text: "#241f17", soft: "#6f6347", dot: "#c8472b" },
  ink:    { name: "Ink",    bg: "#1f1b16", text: "#f7f1e3", soft: "#bcae97", dot: "#e0a04a" },
  sage:   { name: "Sage",   bg: "#5f7256", text: "#f8f5ec", soft: "#dde3d2", dot: "#f0d9a8" },
  clay:   { name: "Clay",   bg: "#b3442b", text: "#fdeee6", soft: "#f2cebe", dot: "#ffe6d2" },
  sky:    { name: "Sky",    bg: "#dce8ee", text: "#1c2a32", soft: "#4a5d68", dot: "#2f7d95" },
  ocean:  { name: "Ocean",  bg: "#1e3a44", text: "#eaf3f4", soft: "#a8c4c8", dot: "#7fc6c0" },
  plum:   { name: "Plum",   bg: "#3a2740", text: "#f3e9f0", soft: "#c4abc6", dot: "#d39bd0" },
  honey:  { name: "Honey",  bg: "#f0d79a", text: "#3a2c12", soft: "#7a6230", dot: "#b3442b" },
  forest: { name: "Forest", bg: "#243027", text: "#e9f0e6", soft: "#aebfa9", dot: "#9bc48a" },
  rose:   { name: "Rose",   bg: "#f3dde0", text: "#3a2226", soft: "#7a5158", dot: "#c8472b" },
};
const THEME_KEYS = Object.keys(THEMES);

const LAYOUTS = [
  { key: "title",      label: "Cover" },
  { key: "text",       label: "Text" },
  { key: "text-image", label: "Text + Photo" },
  { key: "image-text", label: "Photo + Text" },
  { key: "full-image", label: "Full photo" },
];
const LAYOUT_KEYS = LAYOUTS.map((l) => l.key);

// ── Markdown → structured deck ────────────────────────────────────
export function parsePresentation(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  let deckTitle = "";
  let metaLine = "";
  const slides = [];
  const notesRaw = [];
  let mode = "preamble";
  let cur = null;

  const flush = () => { if (cur) { slides.push(cur); cur = null; } };
  const newSlide = (title) => ({
    title: title || `Slide ${slides.length + 1}`,
    bullets: [], notes: "", imageQuery: "", image: null, layout: "", bg: "",
  });

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      const heading = h2[1].trim();
      const slideMatch = heading.match(/^slide\s+\d+\s*[—:\-]?\s*(.*)$/i);
      if (/^speaker notes$/i.test(heading)) { flush(); mode = "notes"; continue; }
      if (slideMatch) { flush(); cur = newSlide(slideMatch[1].trim()); mode = "slide"; continue; }
      if (mode === "preamble" && !deckTitle) {
        deckTitle = heading.replace(/^title$/i, "").trim();
        continue;
      }
      flush(); cur = newSlide(heading); mode = "slide"; continue;
    }

    if (mode === "preamble") {
      const m = line.match(/^\*(.+)\*$/);
      if (m) metaLine = m[1].trim();
      else if (line && !deckTitle) deckTitle = line.trim();
      continue;
    }
    if (mode === "slide" && cur) {
      const img = line.match(/^image:\s*(.+)$/i);
      if (img) { cur.imageQuery = img[1].trim(); continue; }
      const lay = line.match(/^layout:\s*([a-z-]+)/i);
      if (lay) {
        const v = lay[1].toLowerCase();
        if (LAYOUT_KEYS.includes(v)) cur.layout = v;
        continue;
      }
      const bgm = line.match(/^(?:bg|background):\s*([a-z]+)/i);
      if (bgm) {
        const v = bgm[1].toLowerCase();
        if (THEME_KEYS.includes(v)) cur.bg = v;
        continue;
      }
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

  for (const n of notesRaw) {
    const m = n.match(/^slide\s+(\d+)\s*[:\-—]\s*(.*)$/i);
    if (m) {
      const idx = Number(m[1]) - 1;
      if (slides[idx]) slides[idx].notes = m[2].trim();
    }
  }

  if (slides.length === 0) slides.push(newSlide(deckTitle || "Slide 1"));

  // Defaults: slide 1 = cover; rotate backgrounds so a deck never comes
  // out as a wall of identical white slides if the AI didn't pick one.
  const ROTATE = ["paper", "sand", "sky", "sage", "honey", "rose"];
  slides.forEach((s, i) => {
    if (!s.layout) s.layout = i === 0 ? "title" : s.imageQuery ? "text-image" : "text";
    if (!s.bg) s.bg = i === 0 ? "ink" : ROTATE[i % ROTATE.length];
  });

  return { deckTitle: deckTitle || "Untitled presentation", metaLine, slides };
}

// Saved presentation row → builder deck. Handles both the rich shape we
// now save and the legacy { title, body, image_url } shape.
export function deckFromPresentation(p) {
  const slides = (p?.slides || []).map((s, i) => {
    const bullets =
      Array.isArray(s.bullets) && s.bullets.length
        ? s.bullets
        : String(s.body || "")
            .split(/\n+/)
            .map((l) => l.replace(/^[•\-*]\s*/, "").trim())
            .filter(Boolean);
    let image = s.image || null;
    if (!image && s.image_url) image = { url: s.image_url, thumb: s.image_url };
    return {
      title: s.title || `Slide ${i + 1}`,
      bullets,
      notes: s.notes || "",
      imageQuery: s.imageQuery || "",
      image,
      layout: LAYOUT_KEYS.includes(s.layout) ? s.layout : (image ? "text-image" : (i === 0 ? "title" : "text")),
      bg: THEME_KEYS.includes(s.bg) ? s.bg : (i === 0 ? "ink" : "paper"),
    };
  });
  return {
    deckTitle: p?.title || "Untitled presentation",
    metaLine: "",
    slides: slides.length ? slides : [{ title: "Slide 1", bullets: [], notes: "", imageQuery: "", image: null, layout: "title", bg: "ink" }],
  };
}

function fieldsFromMeta(metaLine) {
  const parts = String(metaLine || "").split(/·|—|\|/).map((s) => s.trim()).filter(Boolean);
  const out = { subject: "", grade: "", section: "" };
  parts.forEach((p) => {
    if (/grade/i.test(p)) out.grade = p;
    else if (/section/i.test(p)) out.section = p;
    else if (/scheduled/i.test(p)) { /* set elsewhere */ }
    else if (!out.subject) out.subject = p;
  });
  return out;
}

// Slides → the persisted shape (keeps legacy { title, body } for old
// readers; rich keys ride alongside).
function slidesForSave(slides) {
  return slides.map((s) => ({
    title: s.title,
    body: (s.bullets || []).filter(Boolean).map((b) => `• ${b}`).join("\n"),
    bullets: (s.bullets || []).filter(Boolean),
    notes: s.notes || "",
    image: s.image || null,
    layout: s.layout || "text",
    bg: s.bg || "paper",
  }));
}

export default function SlideBuilder({
  markdown, deck, presentationId, meta, presentationParams, onSaved, onClose,
}) {
  const initial = useMemo(
    () => (deck ? deck : parsePresentation(markdown)),
    [deck, markdown]
  );
  const [deckTitle, setDeckTitle] = useState(initial.deckTitle);
  const [slides, setSlides] = useState(initial.slides);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(presentationId || null);
  const [err, setErr] = useState(null);
  const [picker, setPicker] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  // Editable metadata (only surfaced when editing a saved deck).
  const [status, setStatus] = useState(meta?.status || "Draft");
  const [scheduledFor, setScheduledFor] = useState(
    meta?.scheduled_for ? String(meta.scheduled_for).slice(0, 10) : ""
  );

  useEffect(() => {
    setDeckTitle(initial.deckTitle);
    setSlides(initial.slides);
    setActive(0);
    setSavedId(presentationId || null);
  }, [initial, presentationId]);

  const cur = slides[active] || slides[0];
  const theme = THEMES[cur?.bg] || THEMES.paper;

  const patchSlide = (i, patch) =>
    setSlides((s) => s.map((sl, idx) => (idx === i ? { ...sl, ...patch } : sl)));
  const patchActive = (patch) => patchSlide(active, patch);
  const setBullet = (bi, val) =>
    patchActive({ bullets: cur.bullets.map((b, i) => (i === bi ? val : b)) });
  const addBullet = () => patchActive({ bullets: [...(cur.bullets || []), ""] });
  const removeBullet = (bi) =>
    patchActive({ bullets: cur.bullets.filter((_, i) => i !== bi) });

  const addSlide = () => {
    const next = [
      ...slides,
      { title: "New slide", bullets: [""], notes: "", imageQuery: "", image: null, layout: "text", bg: cur?.bg || "paper" },
    ];
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

  const autoFillPhotos = async () => {
    setAutoBusy(true);
    setErr(null);
    try {
      const updated = await Promise.all(
        slides.map(async (s) => {
          if (s.image || !s.imageQuery) return s;
          try {
            const { photos } = await api(
              `/api/images/search?q=${encodeURIComponent(s.imageQuery)}`
            );
            const p = photos?.[0];
            return p
              ? { ...s, image: { url: p.full, thumb: p.thumb, alt: p.alt, credit: p.credit } }
              : s;
          } catch { return s; }
        })
      );
      setSlides(updated);
    } catch (e) {
      setErr(e.message);
    } finally {
      setAutoBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const mFromLine = fieldsFromMeta(initial.metaLine);
      const body = {
        title: deckTitle || "Untitled presentation",
        subject: meta?.subject || mFromLine.subject || presentationParams?.major || "",
        grade: meta?.grade || presentationParams?.grade || "",
        section: meta?.section ||
          (Array.isArray(presentationParams?.section)
            ? presentationParams.section.join(", ")
            : (presentationParams?.section || "")),
        status: status || "Draft",
        scheduled_for: scheduledFor || presentationParams?.scheduled_for || null,
        slides: slidesForSave(slides),
      };
      const saved = savedId
        ? await api(`/api/presentations/${savedId}`, { method: "PATCH", body })
        : await api("/api/presentations", { method: "POST", body });
      setSavedId(saved.id);
      onSaved?.(saved, !presentationId && !savedId);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const anySuggested = slides.some((s) => s.imageQuery && !s.image);
  const editingExisting = Boolean(meta || presentationId);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
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
          {anySuggested && (
            <button
              type="button"
              onClick={autoFillPhotos}
              disabled={autoBusy}
              className="planner-nav-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-paper-cool hover:border-ink text-ink-soft text-sm disabled:opacity-50"
              title="Fetch the AI-suggested real photo for every slide"
            >
              {autoBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-accent" />}
              {autoBusy ? "Finding photos…" : "Auto-fill photos"}
            </button>
          )}
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
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close editor"
              className="h-9 w-9 rounded-lg border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink flex items-center justify-center"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {editingExisting && (
        <div className="flex flex-wrap items-end gap-4 mb-4 px-1">
          <label className="text-[12px]">
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mb-1">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-line bg-paper-cool px-3 py-1.5 text-sm outline-none focus:border-ink"
            >
              <option>Draft</option><option>Ready</option><option>Archived</option>
            </select>
          </label>
          <label className="text-[12px]">
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mb-1">Scheduled for</span>
            <input
              type="date"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="rounded-lg border border-line bg-paper-cool px-3 py-1.5 text-sm outline-none focus:border-ink"
            />
          </label>
        </div>
      )}

      {err && (
        <div className="mb-3 bg-paper border border-accent rounded-lg p-2.5">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-5">
        {/* Thumbnail rail */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1">
          {slides.map((s, i) => {
            const t = THEMES[s.bg] || THEMES.paper;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                className={`group relative flex-shrink-0 w-[160px] lg:w-full aspect-[16/9] rounded-lg border text-left overflow-hidden transition-all ${
                  i === active ? "border-accent shadow-[0_0_0_3px_rgba(200,71,43,0.12)]" : "border-line hover:border-ink/40"
                }`}
                style={{ background: t.bg }}
              >
                {s.image && (
                  <img src={resolveSrc(s.image.thumb || s.image.url)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                )}
                <div className="absolute inset-0 p-2">
                  <span className="font-mono text-[9px] absolute top-1.5 right-2" style={{ color: t.soft }}>{i + 1}</span>
                  <p className="font-serif text-[11px] font-medium leading-tight line-clamp-2 pr-4" style={{ color: t.text }}>
                    {s.title || "Untitled"}
                  </p>
                  <p className="text-[8.5px] mt-1 line-clamp-3 leading-snug" style={{ color: t.soft }}>
                    {(s.bullets || []).filter(Boolean).join(" · ")}
                  </p>
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={addSlide}
            className="flex-shrink-0 w-[160px] lg:w-full aspect-[16/9] rounded-lg border border-dashed border-line text-muted hover:border-ink hover:text-ink transition flex flex-col items-center justify-center gap-1"
          >
            <Plus size={16} />
            <span className="text-[10px] font-medium">Add slide</span>
          </button>
        </div>

        {/* Editor column */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
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

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3 px-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mr-1">Layout</span>
              {LAYOUTS.map((l) => (
                <button key={l.key} type="button" onClick={() => patchActive({ layout: l.key })}
                  className={`px-2.5 py-1 rounded-md text-[11px] border transition ${
                    cur?.layout === l.key ? "bg-ink text-paper-cool border-ink" : "bg-paper-cool text-ink-soft border-line hover:border-ink"
                  }`}>
                  {l.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mr-1">Background</span>
              {THEME_KEYS.map((k) => (
                <button key={k} type="button" onClick={() => patchActive({ bg: k })}
                  title={THEMES[k].name} aria-label={THEMES[k].name}
                  className={`h-6 w-6 rounded-full border-2 transition ${
                    cur?.bg === k ? "border-accent scale-110" : "border-line hover:border-ink"
                  }`}
                  style={{ background: THEMES[k].bg }} />
              ))}
            </div>
            <button type="button" onClick={() => setPicker(true)}
              className="planner-nav-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-paper-cool hover:border-ink text-ink-soft text-[12px]">
              <ImageIcon size={13} /> {cur?.image ? "Change photo" : "Add photo"}
            </button>
          </div>

          <SlideCanvas
            slide={cur}
            theme={theme}
            index={active}
            total={slides.length}
            editable
            onPatch={patchActive}
            onSetBullet={setBullet}
            onAddBullet={addBullet}
            onRemoveBullet={removeBullet}
            onOpenPicker={() => setPicker(true)}
          />

          <div className="mt-3">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted mb-1.5">Speaker notes</p>
            <textarea
              value={cur?.notes || ""}
              onChange={(e) => patchActive({ notes: e.target.value })}
              rows={2}
              placeholder="What you'll say while this slide is up (optional)…"
              className="w-full rounded-lg border border-line bg-paper-cool px-3 py-2 text-[13px] text-ink outline-none focus:border-ink resize-none placeholder:text-muted/60"
            />
          </div>
        </div>
      </div>

      {picker && (
        <ImagePicker
          suggestedQuery={cur?.imageQuery || cur?.title || ""}
          onClose={() => setPicker(false)}
          onPick={(image) => { patchActive({ image }); setPicker(false); }}
        />
      )}
    </div>
  );
}

// ── The slide canvas — renders the chosen layout. Editable in the
// builder, static in the presenter. ──────────────────────────────
function SlideCanvas({
  slide, theme, index, total, editable = false,
  onPatch, onSetBullet, onAddBullet, onRemoveBullet, onOpenPicker,
}) {
  const layout = slide?.layout || "text";
  const hasImage = Boolean(slide?.image);

  const titleNode = editable ? (
    <textarea
      value={slide?.title || ""}
      onChange={(e) => onPatch({ title: e.target.value })}
      rows={layout === "title" ? 2 : 1}
      className={`w-full font-serif font-semibold bg-transparent outline-none resize-none leading-tight tracking-tight rounded px-1 -mx-1 ${
        layout === "title" ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl"
      }`}
      style={{ color: theme.text }}
      placeholder="Slide title"
      aria-label="Slide title"
    />
  ) : (
    <h2
      className={`font-serif font-semibold leading-tight tracking-tight ${
        layout === "title" ? "text-4xl md:text-6xl" : "text-2xl md:text-4xl"
      }`}
      style={{ color: theme.text }}
    >
      {slide?.title}
    </h2>
  );

  const bulletsNode = (
    <div className="mt-4 flex flex-col gap-2">
      {(slide?.bullets || []).map((b, bi) =>
        editable ? (
          <div key={bi} className="flex items-start gap-2.5 group">
            <span className="mt-2 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: theme.dot }} />
            <textarea
              value={b}
              onChange={(e) => onSetBullet(bi, e.target.value)}
              rows={1}
              placeholder="Type a point…"
              className="flex-1 text-[15px] md:text-base bg-transparent outline-none resize-none leading-snug rounded px-1 -mx-1"
              style={{ color: theme.soft }}
            />
            <button
              type="button"
              onClick={() => onRemoveBullet(bi)}
              aria-label="Remove point"
              className="opacity-0 group-hover:opacity-100 transition mt-1 h-5 w-5 rounded flex items-center justify-center flex-shrink-0"
              style={{ color: theme.soft }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ) : b ? (
          <div key={bi} className="flex items-start gap-3">
            <span className="mt-2.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: theme.dot }} />
            <span className="text-base md:text-xl leading-snug" style={{ color: theme.soft }}>{b}</span>
          </div>
        ) : null
      )}
      {editable && (
        <button
          type="button"
          onClick={onAddBullet}
          className="self-start inline-flex items-center gap-1.5 text-[12px] font-serif italic mt-1 opacity-80 hover:opacity-100"
          style={{ color: theme.dot }}
        >
          <Plus size={12} /> Add a point
        </button>
      )}
    </div>
  );

  const Photo = ({ className = "" }) =>
    editable ? (
      <button
        type="button"
        onClick={onOpenPicker}
        className={`relative overflow-hidden rounded-xl group ${className}`}
        style={{ background: "rgba(0,0,0,0.04)" }}
      >
        {hasImage ? (
          <>
            <img src={resolveSrc(slide.image.url)} alt={slide.image.alt || ""} className="w-full h-full object-cover" />
            <span className="absolute inset-0 group-hover:bg-black/20 transition flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition text-white text-xs font-medium inline-flex items-center gap-1.5 bg-black/45 px-3 py-1.5 rounded-full">
                <ImageIcon size={13} /> Change photo
              </span>
            </span>
          </>
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl"
            style={{ borderColor: "rgba(0,0,0,0.14)", color: theme.soft }}>
            <ImageIcon size={22} />
            <span className="text-[12px] font-medium">Add a photo</span>
            {slide?.imageQuery && (
              <span className="text-[10.5px] italic opacity-70 px-3 text-center">suggested: “{slide.imageQuery}”</span>
            )}
          </span>
        )}
      </button>
    ) : (
      <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ background: "rgba(0,0,0,0.04)" }}>
        {hasImage && <img src={resolveSrc(slide.image.url)} alt={slide.image.alt || ""} className="w-full h-full object-cover" />}
      </div>
    );

  return (
    <div
      className="aspect-[16/9] rounded-xl border border-[#e6dccb] shadow-[0_18px_44px_-22px_rgba(15,20,16,0.18)] relative overflow-hidden"
      style={{ background: theme.bg }}
    >
      {layout === "title" && (
        hasImage ? (
          // Hero cover: the photo fills the slide with a readable scrim,
          // and the title sits large and centered on top. This is what
          // makes "Cover" distinct from "Full photo" (whose title is a
          // small bottom caption).
          <div className="absolute inset-0">
            <img
              src={resolveSrc(slide.image.url)}
              alt={slide.image.alt || ""}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/50 to-black/35 pointer-events-none" />
            <div className="absolute inset-0 flex flex-col justify-center px-12 md:px-16">
              <div className="max-w-3xl">
                {editable ? (
                  <textarea
                    value={slide?.title || ""}
                    onChange={(e) => onPatch({ title: e.target.value })}
                    rows={2}
                    className="w-full font-serif text-4xl md:text-5xl font-semibold bg-transparent outline-none resize-none leading-tight tracking-tight text-white drop-shadow rounded px-1 -mx-1"
                    placeholder="Slide title"
                    aria-label="Slide title"
                  />
                ) : (
                  <h2 className="font-serif text-4xl md:text-6xl font-semibold leading-tight tracking-tight text-white drop-shadow">
                    {slide?.title}
                  </h2>
                )}
              </div>
              <div className="mt-4 max-w-2xl flex flex-col gap-2">
                {(slide?.bullets || []).map((b, bi) =>
                  editable ? (
                    <div key={bi} className="flex items-start gap-2.5 group">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-white/80" />
                      <textarea
                        value={b}
                        onChange={(e) => onSetBullet(bi, e.target.value)}
                        rows={1}
                        placeholder="Type a point…"
                        className="flex-1 text-[15px] md:text-base bg-transparent outline-none resize-none leading-snug rounded px-1 -mx-1 text-white/90 placeholder:text-white/50"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveBullet(bi)}
                        aria-label="Remove point"
                        className="opacity-0 group-hover:opacity-100 transition mt-1 h-5 w-5 rounded flex items-center justify-center flex-shrink-0 text-white/70"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ) : b ? (
                    <div key={bi} className="flex items-start gap-3">
                      <span className="mt-2.5 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-white/80" />
                      <span className="text-base md:text-xl leading-snug text-white/90 drop-shadow">{b}</span>
                    </div>
                  ) : null
                )}
                {editable && (
                  <button
                    type="button"
                    onClick={onAddBullet}
                    className="self-start inline-flex items-center gap-1.5 text-[12px] font-serif italic mt-1 text-white/80 hover:text-white"
                  >
                    <Plus size={12} /> Add a point
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col justify-center px-12 md:px-16">
            <div className="max-w-3xl">{titleNode}</div>
            <div className="mt-3 max-w-2xl">{bulletsNode}</div>
          </div>
        )
      )}
      {layout === "text" && (
        <div className="absolute inset-0 flex flex-col p-10 md:p-12">
          {titleNode}
          {bulletsNode}
        </div>
      )}
      {layout === "text-image" && (
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="flex flex-col p-9 md:p-11 overflow-auto">
            {titleNode}
            {bulletsNode}
          </div>
          <div className="p-4"><Photo className="w-full h-full" /></div>
        </div>
      )}
      {layout === "image-text" && (
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="p-4"><Photo className="w-full h-full" /></div>
          <div className="flex flex-col p-9 md:p-11 overflow-auto">
            {titleNode}
            {bulletsNode}
          </div>
        </div>
      )}
      {layout === "full-image" && (
        <div className="absolute inset-0">
          <Photo className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 p-10 md:p-12">
            {editable ? (
              <textarea
                value={slide?.title || ""}
                onChange={(e) => onPatch({ title: e.target.value })}
                rows={2}
                className="w-full font-serif text-3xl md:text-4xl font-semibold bg-transparent outline-none resize-none leading-tight text-white drop-shadow rounded px-1 -mx-1"
                placeholder="Slide title"
                aria-label="Slide title"
              />
            ) : (
              <h2 className="font-serif text-3xl md:text-5xl font-semibold leading-tight text-white drop-shadow">
                {slide?.title}
              </h2>
            )}
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {(slide?.bullets || []).filter(Boolean).map((b, i) => (
                <span key={i} className="text-white/90 text-sm md:text-base inline-flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-white/80" /> {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      <span className="absolute bottom-4 right-5 font-mono text-[10px]" style={{ color: theme.soft }}>
        {index + 1} / {total}
      </span>
    </div>
  );
}

// ── Full-screen presenter (read-only) ─────────────────────────────
export function PresentDeck({ presentation, onClose }) {
  const deck = useMemo(() => deckFromPresentation(presentation), [presentation]);
  const slides = deck.slides;
  const [idx, setIdx] = useState(0);
  const cur = slides[idx];
  const theme = THEMES[cur?.bg] || THEMES.paper;

  const go = useCallback(
    (d) => setIdx((i) => Math.max(0, Math.min(slides.length - 1, i + d))),
    [slides.length]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col">
      <div className="flex items-center justify-between px-5 py-2.5 text-paper-cool/70">
        <p className="font-mono text-[10px] uppercase tracking-wider">
          {presentation.title} · {idx + 1} / {slides.length}
        </p>
        <button onClick={onClose} className="font-mono text-[11px] uppercase tracking-wider hover:text-paper-cool inline-flex items-center gap-1.5">
          <X size={13} /> Exit
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-6 min-h-0">
        <div className="w-full max-w-[min(96vw,calc(82vh*16/9))]">
          <SlideCanvas slide={cur} theme={theme} index={idx} total={slides.length} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={idx === 0}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-paper-cool flex items-center justify-center disabled:opacity-25"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={idx >= slides.length - 1}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-paper-cool flex items-center justify-center disabled:opacity-25"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

// ── Image picker — Pexels search + own upload ─────────────────────
function ImagePicker({ suggestedQuery, onClose, onPick }) {
  const [tab, setTab] = useState("search");
  const [q, setQ] = useState(suggestedQuery || "");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileRef = useRef(null);
  const ranInitial = useRef(false);

  const runSearch = async (term) => {
    const query = (term ?? q).trim();
    if (!query) return;
    setBusy(true);
    setError(null);
    try {
      const { photos } = await api(`/api/images/search?q=${encodeURIComponent(query)}`);
      setResults(photos || []);
    } catch (e) {
      setError(e.message);
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!ranInitial.current && suggestedQuery) {
      ranInitial.current = true;
      runSearch(suggestedQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setUploadBusy(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        try {
          const max = 1600;
          let { width, height } = img;
          if (width > max || height > max) {
            const r = Math.min(max / width, max / height);
            width = Math.round(width * r);
            height = Math.round(height * r);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const { url } = await api("/api/images/upload", { method: "POST", body: { dataUrl } });
          onPick({ url, thumb: url, alt: file.name, credit: "Uploaded" });
        } catch (e) {
          setError(e.message);
          setUploadBusy(false);
        }
      };
      img.onerror = () => { setError("Could not read that image."); setUploadBusy(false); };
      img.src = reader.result;
    };
    reader.onerror = () => { setError("Could not read that file."); setUploadBusy(false); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-line bg-paper-cool shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
          <div className="flex items-center gap-1.5">
            {["search", "upload"].map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 transition ${
                  tab === t ? "bg-ink text-paper-cool" : "text-ink-soft hover:bg-paper-warm"
                }`}>
                {t === "search" ? <Search size={13} /> : <Upload size={13} />}
                {t === "search" ? "Search photos" : "Upload"}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-line bg-paper-cool hover:bg-paper-warm flex items-center justify-center" aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-3 bg-paper border border-accent rounded-lg p-2.5">
              <p className="text-sm text-accent">{error}</p>
            </div>
          )}

          {tab === "search" ? (
            <>
              <form onSubmit={(e) => { e.preventDefault(); runSearch(); }} className="flex items-center gap-2 mb-4">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search real photos — e.g. 'rain on leaves'…"
                  className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-ink"
                />
                <button type="submit" disabled={busy || !q.trim()}
                  className="planner-nav-btn px-4 py-2 rounded-lg bg-ink text-paper-cool text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Search
                </button>
              </form>
              {busy ? (
                <p className="text-center text-muted text-sm py-10">Searching photos…</p>
              ) : results.length === 0 ? (
                <p className="text-center text-muted text-sm py-10">Search for a subject to see real stock photos.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {results.map((p) => (
                    <button key={p.id} type="button"
                      onClick={() => onPick({ url: p.full, thumb: p.thumb, alt: p.alt, credit: p.credit })}
                      className="group relative aspect-[4/3] rounded-lg overflow-hidden border border-line hover:border-accent">
                      <img src={p.thumb} alt={p.alt} className="w-full h-full object-cover" loading="lazy" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[9px] px-1.5 py-0.5 truncate opacity-0 group-hover:opacity-100 transition">
                        {p.credit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
              className="border-2 border-dashed border-line rounded-2xl p-10 text-center"
            >
              <Upload size={26} className="mx-auto text-muted mb-3" />
              <p className="text-sm text-ink-soft mb-1">Drag an image here, or</p>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadBusy}
                className="planner-nav-btn px-4 py-2 rounded-lg bg-ink text-paper-cool text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1.5 mt-1">
                {uploadBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploadBusy ? "Uploading…" : "Choose a file"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])} />
              <p className="text-xs text-muted mt-3">
                Your own photos (classroom, school logo…). Stored with this presentation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
