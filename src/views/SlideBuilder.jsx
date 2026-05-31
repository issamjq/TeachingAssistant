// SlideBuilder — a "smart deck" editor (Gamma/Pitch style) plus a
// read-only presenter. Used in two places:
//   • Studio  — pass `markdown` (the AI output) to author a fresh deck.
//   • Presentations chip — pass `deck` + `presentationId` + `meta` to
//     re-open a saved deck for editing; `PresentDeck` renders it full
//     screen for teaching.
// Photos are always real (Pexels search or the teacher's own upload),
// never AI. Murchid editorial theme throughout.
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Check, Image as ImageIcon,
  Search, Upload, X, Sparkles, Presentation as DeckIcon, Loader2,
  ChevronLeft, ChevronRight, FileDown, Pencil,
} from "lucide-react";
import { api, DatePicker } from "./_shared";
import { useT } from "../lib/i18n";

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

// Tiny schematic preview of a slide layout, drawn with plain bars/boxes so
// the teacher recognises each option at a glance (like the thumbnails in a
// native layout picker).
function LayoutThumb({ layout }) {
  const bar = "block rounded-[1px] bg-ink-soft/70";
  const box = "block rounded-[2px] bg-ink-soft/30";
  return (
    <span className="block w-full aspect-[4/3] rounded-md border border-line bg-paper p-1.5 overflow-hidden">
      {layout === "title" && (
        <span className="flex flex-col items-center justify-center h-full gap-1">
          <span className={`${bar} h-1.5 w-3/5`} />
          <span className={`${bar} h-1 w-2/5 opacity-50`} />
        </span>
      )}
      {layout === "text" && (
        <span className="flex flex-col justify-center h-full gap-[3px]">
          <span className={`${bar} h-1 w-full`} />
          <span className={`${bar} h-1 w-5/6`} />
          <span className={`${bar} h-1 w-3/4`} />
        </span>
      )}
      {layout === "text-image" && (
        <span className="flex h-full gap-1.5">
          <span className="flex flex-col justify-center gap-[3px] flex-1">
            <span className={`${bar} h-1 w-full`} />
            <span className={`${bar} h-1 w-4/5`} />
            <span className={`${bar} h-1 w-3/5`} />
          </span>
          <span className={`${box} w-2/5 h-full`} />
        </span>
      )}
      {layout === "image-text" && (
        <span className="flex h-full gap-1.5">
          <span className={`${box} w-2/5 h-full`} />
          <span className="flex flex-col justify-center gap-[3px] flex-1">
            <span className={`${bar} h-1 w-full`} />
            <span className={`${bar} h-1 w-4/5`} />
            <span className={`${bar} h-1 w-3/5`} />
          </span>
        </span>
      )}
      {layout === "full-image" && <span className={`${box} h-full w-full`} />}
    </span>
  );
}

// Popover layout picker: a compact trigger showing the current layout that
// opens a grid of labelled thumbnails — replaces the long inline button row.
function LayoutPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LAYOUTS.find((l) => l.key === value) || LAYOUTS[0];
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border border-line bg-paper-cool text-ink hover:border-ink transition"
      >
        {current.label}
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-[252px] rounded-2xl border border-line bg-paper-cool shadow-[0_18px_44px_-18px_rgba(15,20,16,0.32)] p-2 animate-[popIn_160ms_cubic-bezier(0.22,1,0.36,1)]">
          <div className="grid grid-cols-3 gap-1.5">
            {LAYOUTS.map((l) => {
              const isActive = l.key === value;
              return (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => { onChange(l.key); setOpen(false); }}
                  className={`group flex flex-col gap-1 rounded-lg border p-1.5 transition ${
                    isActive ? "border-accent bg-accent/[0.06]" : "border-transparent hover:border-line hover:bg-paper-warm/60"
                  }`}
                >
                  <LayoutThumb layout={l.key} />
                  <span className={`text-[10px] leading-tight text-center ${isActive ? "text-accent font-medium" : "text-ink-soft"}`}>
                    {l.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
}

const isHex = (v) => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

// WCAG relative luminance, 0 (black) → 1 (white).
function hexLuminance(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const ch = (i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}

// A slide's bg is either a curated theme key OR a custom hex. For hex we
// synthesize a theme, auto-picking light/dark text so it stays readable.
function resolveTheme(bg) {
  if (bg && THEMES[bg]) return THEMES[bg];
  if (isHex(bg)) {
    const dark = hexLuminance(bg) < 0.5;
    return dark
      ? { name: "Custom", bg, text: "#f7f1e3", soft: "rgba(247,241,227,0.78)", dot: "#e8b06a" }
      : { name: "Custom", bg, text: "#1f1b16", soft: "rgba(31,27,22,0.64)", dot: "#c8472b" };
  }
  return THEMES.paper;
}

function hexToRgba(hex, a) {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return `rgba(0,0,0,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Font pairings (only fonts the app already loads: Fraunces, Inter
// Tight, Amiri). Each gives a title + body family.
const FONTS = {
  editorial: { name: "Editorial", title: "'Fraunces', Georgia, serif",            body: "'Inter Tight', system-ui, sans-serif" },
  modern:    { name: "Modern",    title: "'Inter Tight', system-ui, sans-serif",   body: "'Inter Tight', system-ui, sans-serif" },
  classic:   { name: "Classic",   title: "'Fraunces', Georgia, serif",            body: "'Fraunces', Georgia, serif" },
  amiri:     { name: "Amiri",     title: "'Amiri', 'Times New Roman', serif",      body: "'Amiri', 'Times New Roman', serif" },
};
const FONT_KEYS = Object.keys(FONTS);
const fontOf = (k) => FONTS[k] || FONTS.editorial;

// Per-line formatting: { color?, font?, b?, i?, u? }. Stored alongside
// the plain text (title/bullets stay strings, so AI parsing, copy and
// save are untouched) and merged over the slide's base style here.
function lineStyle(fmt, base, kind) {
  const s = { ...base };
  if (!fmt) return s;
  if (isHex(fmt.color)) s.color = fmt.color;
  if (fmt.font && FONTS[fmt.font]) s.fontFamily = FONTS[fmt.font][kind === "title" ? "title" : "body"];
  if (fmt.b) s.fontWeight = 800;
  if (fmt.i) s.fontStyle = "italic";
  if (fmt.u) s.textDecoration = "underline";
  return s;
}

// Per-slide photo dim/brighten. v ∈ [-60, 60]: <0 darkens (black wash),
// >0 brightens (white wash). Returns an overlay style or null.
function dimStyle(v) {
  const n = Number(v) || 0;
  if (!n) return null;
  return n < 0
    ? { background: `rgba(0,0,0,${Math.min(0.72, -n / 100)})` }
    : { background: `rgba(255,255,255,${Math.min(0.72, n / 100)})` };
}

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
    imgAdjust: 0, font: "editorial", textColor: "",
    titleFmt: {}, bulletFmts: [],
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
      bg: THEME_KEYS.includes(s.bg) || isHex(s.bg) ? s.bg : (i === 0 ? "ink" : "paper"),
      imgAdjust: Number(s.imgAdjust) || 0,
      font: FONT_KEYS.includes(s.font) ? s.font : "editorial",
      textColor: isHex(s.textColor) ? s.textColor : "",
      titleFmt: s.titleFmt && typeof s.titleFmt === "object" ? s.titleFmt : {},
      bulletFmts: Array.isArray(s.bulletFmts) ? s.bulletFmts : [],
    };
  });
  return {
    deckTitle: p?.title || "Untitled presentation",
    metaLine: "",
    slides: slides.length ? slides : [{ title: "Slide 1", bullets: [], notes: "", imageQuery: "", image: null, layout: "title", bg: "ink", imgAdjust: 0, font: "editorial", textColor: "", titleFmt: {}, bulletFmts: [] }],
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
    imgAdjust: Number(s.imgAdjust) || 0,
    font: s.font || "editorial",
    textColor: isHex(s.textColor) ? s.textColor : "",
    titleFmt: s.titleFmt && typeof s.titleFmt === "object" ? s.titleFmt : {},
    bulletFmts: Array.isArray(s.bulletFmts) ? s.bulletFmts : [],
  }));
}

export default function SlideBuilder({
  markdown, deck, presentationId, meta, presentationParams, onSaved, onClose,
}) {
  const t = useT();
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
  const theme = resolveTheme(cur?.bg);

  const patchSlide = (i, patch) =>
    setSlides((s) => s.map((sl, idx) => (idx === i ? { ...sl, ...patch } : sl)));
  const patchActive = (patch) => patchSlide(active, patch);
  const setBullet = (bi, val) =>
    patchActive({ bullets: cur.bullets.map((b, i) => (i === bi ? val : b)) });
  const addBullet = () => patchActive({ bullets: [...(cur.bullets || []), ""] });
  const removeBullet = (bi) =>
    patchActive({
      bullets: cur.bullets.filter((_, i) => i !== bi),
      // Keep per-line formatting aligned with the remaining bullets.
      bulletFmts: (cur.bulletFmts || []).filter((_, i) => i !== bi),
    });
  // Apply one property to every slide ("Apply to all slides").
  const applyAll = (patch) => setSlides((s) => s.map((sl) => ({ ...sl, ...patch })));

  const addSlide = () => {
    const next = [
      ...slides,
      { title: "New slide", bullets: [""], notes: "", imageQuery: "", image: null, layout: "text", bg: cur?.bg || "paper", imgAdjust: 0, font: cur?.font || "editorial", textColor: cur?.textColor || "", titleFmt: {}, bulletFmts: [] },
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
      {/* Print-only slide deck — hidden on screen, becomes the only thing
          the page prints. Each slide is wrapped in .deck-print-page which
          forces a page break after it, so a 5-slide deck prints as 5
          landscape pages with the same visual SlideCanvas the teacher
          sees in the editor. CSS lives at the bottom of src/index.css
          under @media print { .deck-print-page ... }. */}
      <div className="hidden print:block">
        {slides.map((s, i) => (
          <div key={s.id || i} className="deck-print-page">
            <SlideCanvas
              slide={s}
              theme={resolveTheme(s.bg)}
              index={i}
              total={slides.length}
              editable={false}
            />
          </div>
        ))}
      </div>

      {/* Screen editor — hidden during print so the slide stack above is
          the only thing the browser captures. */}
      <div className="print:hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 rounded-lg bg-accent/[0.12] text-accent items-center justify-center flex-shrink-0">
            <DeckIcon size={14} strokeWidth={2} />
          </span>
          {/* Wrap the title input in a relative box with a dashed border +
              pencil icon so teachers can see at a glance that it's
              editable. The title used to look like static text — the only
              cue you could click it was an underline on focus, which you
              never saw until after you clicked. */}
          <span className="relative inline-flex items-center flex-1 min-w-0 group">
            <input
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              title="Click to edit the presentation title"
              placeholder="Click to name your presentation"
              className="font-serif text-xl md:text-2xl font-medium text-ink bg-paper-warm/40 border border-dashed border-line hover:border-ink/40 focus:border-solid focus:border-ink focus:bg-paper outline-none rounded-md px-2.5 py-1 pe-8 min-w-0 w-full transition-colors duration-150 placeholder:text-muted/70 cursor-text"
              aria-label="Deck title"
            />
            <Pencil
              size={13}
              strokeWidth={1.75}
              aria-hidden
              className="absolute end-2 top-1/2 -translate-y-1/2 text-muted/70 group-focus-within:opacity-0 pointer-events-none transition-opacity"
            />
          </span>
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
          {/* Direct print → Save as PDF. Each slide renders as a full
              landscape page via the print-only deck stack below + the
              .deck-print-page CSS in index.css. The old ExportMenu path
              used printDoc which produced a text outline (one page with
              all slides as bullets) — not what a teacher expects from a
              "PDF" button on a slide deck. */}
          <button
            type="button"
            onClick={() => window.print()}
            title="Save as PDF — one slide per page"
            aria-label="Save as PDF"
            className="h-9 w-9 rounded-lg border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink text-ink-soft flex items-center justify-center transition"
          >
            <FileDown size={14} />
          </button>
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
              className="h-9 w-9 rounded-lg text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition"
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
            <DatePicker
              value={scheduledFor}
              onChange={(v) => setScheduledFor(v)}
              className="rounded-lg border border-line bg-paper-cool px-3 py-1.5 text-sm outline-none focus:border-ink min-w-[160px]"
            />
          </label>
        </div>
      )}

      {err && (
        <div className="mb-3 bg-accent/[0.08] border-2 border-accent rounded-lg p-3 shadow-[0_6px_18px_-8px_rgba(200,71,43,0.3)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent mb-0.5">Save failed — nothing was stored</p>
          <p className="text-sm text-ink-soft">{err}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-5">
        {/* Thumbnail rail */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-1">
          {slides.map((s, i) => {
            const t = resolveTheme(s.bg);
            // Mirror the actual slide layout in the thumbnail so a teacher
            // can see at a glance how each slide is composed. Previous
            // version always painted the image as a 40% full-bleed wash,
            // which made every slide look like a Cover regardless of
            // layout (and the change didn't appear when the teacher
            // edited the right-hand canvas).
            const layout = s.layout || "text";
            const imgSrc = s.image ? resolveSrc(s.image.thumb || s.image.url) : null;
            const sideImage = imgSrc && (layout === "text-image" || layout === "image-text");
            const imageOnLeft = layout === "image-text";
            const bgImage = imgSrc && (layout === "title" || layout === "full-image");
            // On a tinted photo background the body text needs to be near-white
            // to stay legible; otherwise it follows the theme tokens.
            const titleColor = bgImage ? "#ffffff" : t.text;
            const bodyColor = bgImage ? "rgba(255,255,255,0.85)" : t.soft;
            const numColor = bgImage ? "rgba(255,255,255,0.85)" : t.soft;
            const titleAlign =
              layout === "title" ? "flex flex-col items-center justify-center text-center" :
              layout === "full-image" ? "flex flex-col justify-end" :
              "";
            // Leave room next to a side image (left half OR right half) so
            // the text doesn't slide under the photo.
            const textInset = sideImage
              ? (imageOnLeft ? "ps-[calc(50%+0.4rem)]" : "pe-[calc(50%+0.4rem)]")
              : "";
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
                {/* Full-bleed cover image (title / full-image layouts) +
                    a subtle gradient wash so the text stays legible. */}
                {bgImage && (
                  <>
                    <img src={imgSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/35" />
                  </>
                )}
                {/* Side image — half-width on the appropriate side for
                    text-image / image-text layouts. */}
                {sideImage && (
                  <img
                    src={imgSrc}
                    alt=""
                    className={`absolute top-0 ${imageOnLeft ? "left-0" : "right-0"} h-full w-1/2 object-cover`}
                  />
                )}
                <div className={`absolute inset-0 p-2 ${titleAlign} ${textInset}`}>
                  <span className="font-mono text-[9px] absolute top-1.5 right-2" style={{ color: numColor }}>{i + 1}</span>
                  <p className="font-serif text-[11px] font-medium leading-tight line-clamp-2 pr-4" style={{ color: titleColor }}>
                    {s.title || "Untitled"}
                  </p>
                  {/* Cover slides keep the layout focused on the title;
                      every other layout shows a short summary of the bullets. */}
                  {layout !== "title" && (
                    <p className="text-[8.5px] mt-1 line-clamp-3 leading-snug" style={{ color: bodyColor }}>
                      {(s.bullets || []).filter(Boolean).join(" · ")}
                    </p>
                  )}
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
              <LayoutPicker value={cur?.layout} onChange={(layout) => patchActive({ layout })} />
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
              <ColorControl
                value={cur?.bg}
                onChange={(bg) => patchActive({ bg })}
                onApplyAll={(bg) => applyAll({ bg })}
                label="Custom background"
              />
              <button
                type="button"
                onClick={() => applyAll({ bg: cur?.bg })}
                className="text-[10.5px] text-accent hover:text-ink font-serif italic ms-1"
              >
                Apply to all
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mr-1">Text</span>
              <ColorControl
                value={cur?.textColor}
                onChange={(c) => patchActive({ textColor: c })}
                onApplyAll={(c) => applyAll({ textColor: c })}
                onClear={() => patchActive({ textColor: "" })}
                label="Text colour"
                seedDefault="#1a1814"
                triggerKind="text"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mr-1">Font</span>
              <select
                value={cur?.font || "editorial"}
                onChange={(e) => patchActive({ font: e.target.value })}
                className="rounded-lg border border-line bg-paper-cool px-2.5 py-1 text-[12px] outline-none focus:border-ink cursor-pointer"
                aria-label="Font style"
              >
                {FONT_KEYS.map((k) => (
                  <option key={k} value={k}>{FONTS[k].name}</option>
                ))}
              </select>
              <button type="button" onClick={() => applyAll({ font: cur?.font || "editorial" })}
                className="text-[10.5px] text-accent hover:text-ink font-serif italic">
                Apply to all
              </button>
            </div>
            <button type="button" onClick={() => setPicker(true)}
              className="planner-nav-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-paper-cool hover:border-ink text-ink-soft text-[12px]">
              <ImageIcon size={13} /> {cur?.image ? "Change photo" : "Add photo"}
            </button>
            {cur?.image && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted">Photo</span>
                <span className="text-[10px] text-muted">Dim</span>
                <input
                  type="range"
                  min={-60}
                  max={60}
                  step={5}
                  value={cur?.imgAdjust || 0}
                  onChange={(e) => patchActive({ imgAdjust: Number(e.target.value) })}
                  className="w-28 accent-accent cursor-pointer"
                  aria-label="Photo dim or brighten"
                />
                <span className="text-[10px] text-muted">Bright</span>
                {(cur?.imgAdjust || 0) !== 0 && (
                  <button type="button" onClick={() => patchActive({ imgAdjust: 0 })}
                    className="text-[10px] text-muted hover:text-ink underline">reset</button>
                )}
                <button type="button" onClick={() => applyAll({ imgAdjust: cur?.imgAdjust || 0 })}
                  className="text-[10.5px] text-accent hover:text-ink font-serif italic">
                  Apply to all
                </button>
              </div>
            )}
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

  // Per-slide typography + text colour. textColor (when set) overrides
  // the theme's auto-contrast colour; fonts come from the chosen pairing.
  const f = fontOf(slide?.font);
  const hasTxt = isHex(slide?.textColor);
  const txt = hasTxt ? slide.textColor : theme.text;
  const txtSoft = hasTxt ? hexToRgba(slide.textColor, 0.74) : theme.soft;
  // On photo-covering layouts text is white unless explicitly overridden.
  const onPhoto = hasTxt ? slide.textColor : "#ffffff";
  const onPhotoSoft = hasTxt ? hexToRgba(slide.textColor, 0.88) : "rgba(255,255,255,0.9)";

  // Which line the format toolbar acts on: "title" or a bullet index.
  const [activeLine, setActiveLine] = useState(null);
  const titleFmt = slide?.titleFmt || {};
  const bulletFmts = slide?.bulletFmts || [];
  const setTitleFmt = (patch) => onPatch({ titleFmt: { ...titleFmt, ...patch } });
  const setBulletFmt = (idx, patch) => {
    const arr = Array.isArray(bulletFmts) ? [...bulletFmts] : [];
    arr[idx] = { ...(arr[idx] || {}), ...patch };
    onPatch({ bulletFmts: arr });
  };
  const activeFmt = activeLine === "title" ? titleFmt
    : typeof activeLine === "number" ? (bulletFmts[activeLine] || {}) : null;
  const applyActiveFmt = (patch) => {
    if (activeLine === "title") setTitleFmt(patch);
    else if (typeof activeLine === "number") setBulletFmt(activeLine, patch);
  };

  const titleNode = editable ? (
    <textarea
      value={slide?.title || ""}
      onChange={(e) => onPatch({ title: e.target.value })}
      onFocus={() => setActiveLine("title")}
      rows={layout === "title" ? 2 : 1}
      className={`w-full font-semibold bg-transparent outline-none resize-none leading-tight tracking-tight rounded px-1 -mx-1 ${
        layout === "title" ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl"
      }`}
      style={lineStyle(titleFmt, { color: txt, fontFamily: f.title }, "title")}
      placeholder="Slide title"
      aria-label="Slide title"
    />
  ) : (
    <h2
      className={`font-semibold leading-tight tracking-tight ${
        layout === "title" ? "text-4xl md:text-6xl" : "text-2xl md:text-4xl"
      }`}
      style={lineStyle(titleFmt, { color: txt, fontFamily: f.title }, "title")}
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
              onFocus={() => setActiveLine(bi)}
              rows={1}
              placeholder="Type a point…"
              className="flex-1 text-[15px] md:text-base bg-transparent outline-none resize-none leading-snug rounded px-1 -mx-1"
              style={lineStyle(bulletFmts[bi], { color: txtSoft, fontFamily: f.body }, "body")}
            />
            <button
              type="button"
              onClick={() => onRemoveBullet(bi)}
              aria-label="Remove point"
              className="opacity-0 group-hover:opacity-100 transition mt-1 h-5 w-5 rounded flex items-center justify-center flex-shrink-0"
              style={{ color: txtSoft }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ) : b ? (
          <div key={bi} className="flex items-start gap-3">
            <span className="mt-2.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: theme.dot }} />
            <span className="text-base md:text-xl leading-snug" style={lineStyle(bulletFmts[bi], { color: txtSoft, fontFamily: f.body }, "body")}>{b}</span>
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
            {dimStyle(slide?.imgAdjust) && (
              <span className="absolute inset-0 pointer-events-none" style={dimStyle(slide.imgAdjust)} />
            )}
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
        {hasImage && dimStyle(slide?.imgAdjust) && (
          <span className="absolute inset-0 pointer-events-none" style={dimStyle(slide.imgAdjust)} />
        )}
      </div>
    );

  return (
    <div
      className="aspect-[16/9] rounded-xl border border-[#e6dccb] shadow-[0_18px_44px_-22px_rgba(15,20,16,0.18)] relative overflow-hidden"
      style={{ background: theme.bg }}
    >
      {editable && activeLine !== null && (
        <LineFormatBar
          label={activeLine === "title" ? "Title" : `Line ${Number(activeLine) + 1}`}
          fmt={activeFmt || {}}
          onChange={applyActiveFmt}
          onClose={() => setActiveLine(null)}
        />
      )}
      {layout === "title" && (
        hasImage ? (
          // Cover = a centred TITLE CARD: photo stays clearly visible
          // under a light wash, the title is huge and dead-centre, and
          // the points collapse into one centred tagline. Distinct from
          // Full photo, where the photo dominates and the text is a
          // small bottom-left caption.
          <div className="absolute inset-0">
            <img
              src={resolveSrc(slide.image.url)}
              alt={slide.image.alt || ""}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {dimStyle(slide?.imgAdjust) && (
              <div className="absolute inset-0 pointer-events-none" style={dimStyle(slide.imgAdjust)} />
            )}
            {/* The slide's background colour tints the photo — that's what
                "colour" means once a photo covers the slide. */}
            <div className="absolute inset-0 pointer-events-none mix-blend-multiply" style={{ background: resolveTheme(slide?.bg).bg, opacity: 0.38 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/35 pointer-events-none" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-12 md:px-20">
              {editable ? (
                <textarea
                  value={slide?.title || ""}
                  onChange={(e) => onPatch({ title: e.target.value })}
                  onFocus={() => setActiveLine("title")}
                  rows={2}
                  className="w-full max-w-4xl text-center text-5xl md:text-7xl font-semibold bg-transparent outline-none resize-none leading-[1.05] tracking-tight drop-shadow-lg rounded px-1"
                  style={lineStyle(titleFmt, { color: onPhoto, fontFamily: f.title }, "title")}
                  placeholder="Presentation title"
                  aria-label="Slide title"
                />
              ) : (
                <h2 className="max-w-4xl text-5xl md:text-7xl font-semibold leading-[1.05] tracking-tight drop-shadow-lg"
                  style={lineStyle(titleFmt, { color: onPhoto, fontFamily: f.title }, "title")}>
                  {slide?.title}
                </h2>
              )}
              {editable ? (
                <div className="mt-6 w-full max-w-2xl flex flex-col items-center gap-1.5">
                  {(slide?.bullets || []).map((b, bi) => (
                    <div key={bi} className="w-full flex items-center justify-center gap-2 group">
                      <textarea
                        value={b}
                        onChange={(e) => onSetBullet(bi, e.target.value)}
                        onFocus={() => setActiveLine(bi)}
                        rows={1}
                        placeholder="Subtitle line…"
                        className="flex-1 text-center text-base md:text-xl bg-transparent outline-none resize-none leading-snug rounded px-1 placeholder:text-white/45"
                        style={lineStyle(bulletFmts[bi], { color: onPhotoSoft, fontFamily: f.body }, "body")}
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveBullet(bi)}
                        aria-label="Remove line"
                        className="opacity-0 group-hover:opacity-100 transition h-5 w-5 rounded flex items-center justify-center flex-shrink-0 text-white/60"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={onAddBullet}
                    className="inline-flex items-center gap-1.5 text-[12px] font-serif italic mt-1 text-white/75 hover:text-white"
                  >
                    <Plus size={12} /> Add a subtitle line
                  </button>
                </div>
              ) : (
                (slide?.bullets || []).filter(Boolean).length > 0 && (
                  <p className="mt-6 max-w-2xl text-lg md:text-2xl drop-shadow leading-snug"
                    style={{ color: onPhotoSoft, fontFamily: f.body }}>
                    {(slide.bullets || []).filter(Boolean).join("  ·  ")}
                  </p>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-12 md:px-20">
            <div className="max-w-4xl">{titleNode}</div>
            <div className="mt-4 max-w-2xl">{bulletsNode}</div>
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
          <div className="absolute inset-0 pointer-events-none mix-blend-multiply" style={{ background: resolveTheme(slide?.bg).bg, opacity: 0.32 }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 p-10 md:p-12">
            {editable ? (
              <textarea
                value={slide?.title || ""}
                onChange={(e) => onPatch({ title: e.target.value })}
                onFocus={() => setActiveLine("title")}
                rows={2}
                className="w-full text-3xl md:text-4xl font-semibold bg-transparent outline-none resize-none leading-tight drop-shadow rounded px-1 -mx-1"
                style={lineStyle(titleFmt, { color: onPhoto, fontFamily: f.title }, "title")}
                placeholder="Slide title"
                aria-label="Slide title"
              />
            ) : (
              <h2 className="text-3xl md:text-5xl font-semibold leading-tight drop-shadow"
                style={lineStyle(titleFmt, { color: onPhoto, fontFamily: f.title }, "title")}>
                {slide?.title}
              </h2>
            )}
            {editable ? (
              <div className="mt-3 flex flex-col gap-1.5 max-w-3xl">
                {(slide?.bullets || []).map((b, bi) => (
                  <div key={bi} className="flex items-start gap-2.5 group">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full flex-shrink-0 bg-white/80" />
                    <textarea
                      value={b}
                      onChange={(e) => onSetBullet(bi, e.target.value)}
                      onFocus={() => setActiveLine(bi)}
                      rows={1}
                      placeholder="Type a point…"
                      className="flex-1 text-[15px] md:text-base bg-transparent outline-none resize-none leading-snug rounded px-1 -mx-1 placeholder:text-white/50 drop-shadow"
                      style={lineStyle(bulletFmts[bi], { color: onPhotoSoft, fontFamily: f.body }, "body")}
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
                ))}
                <button
                  type="button"
                  onClick={onAddBullet}
                  className="self-start inline-flex items-center gap-1.5 text-[12px] font-serif italic mt-1 text-white/80 hover:text-white"
                >
                  <Plus size={12} /> Add a point
                </button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                {(slide?.bullets || []).map((b, i) => b ? (
                  <span key={i} className="text-sm md:text-base inline-flex items-center gap-2"
                    style={lineStyle(bulletFmts[i], { color: onPhotoSoft, fontFamily: f.body }, "body")}>
                    <span className="h-1 w-1 rounded-full bg-white/80" /> {b}
                  </span>
                ) : null)}
              </div>
            )}
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
  const theme = resolveTheme(cur?.bg);

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

// Floating per-line toolbar (bold / italic / underline / font / colour)
// for whichever title or bullet line is focused. Sits at the top of the
// slide canvas, like a paint toolbar.
function LineFormatBar({ label, fmt, onChange, onClose }) {
  const toggle = (k) => onChange({ [k]: !fmt[k] });
  const Btn = ({ k, children, title }) => (
    <button
      type="button"
      title={title}
      // Keep the focused textarea's selection — don't steal focus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => toggle(k)}
      className={`h-7 w-7 rounded-md border text-sm flex items-center justify-center transition ${
        fmt[k] ? "bg-ink text-paper-cool border-ink" : "bg-paper-cool text-ink-soft border-line hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
  return (
    <div className="absolute z-30 top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-xl border border-line bg-paper-cool/95 backdrop-blur-md shadow-lg px-2 py-1.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted px-1 hidden sm:inline">{label}</span>
      <Btn k="b" title="Bold"><span className="font-bold">B</span></Btn>
      <Btn k="i" title="Italic"><span className="italic font-serif">I</span></Btn>
      <Btn k="u" title="Underline"><span className="underline">U</span></Btn>
      <span className="w-px h-5 bg-line mx-0.5" />
      <select
        value={fmt.font || ""}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange({ font: e.target.value })}
        className="rounded-md border border-line bg-paper px-1.5 py-1 text-[11px] outline-none focus:border-ink cursor-pointer"
        aria-label="Line font"
        title="Font for this line"
      >
        <option value="">Font: deck</option>
        {FONT_KEYS.map((k) => <option key={k} value={k}>{FONTS[k].name}</option>)}
      </select>
      <ColorControl
        value={fmt.color}
        onChange={(c) => onChange({ color: c })}
        onClear={() => onChange({ color: "" })}
        label="Line colour"
        seedDefault="#1a1814"
        triggerKind="text"
      />
      <span className="w-px h-5 bg-line mx-0.5" />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClose}
        title="Done"
        className="h-7 w-7 rounded-md border border-line bg-paper-cool hover:border-ink text-ink-soft flex items-center justify-center"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── Custom background colour — presets row gets a "+" that opens this.
// Any colour is allowed; text auto-contrasts via resolveTheme(). ──────
const RECENTS_KEY = "murchid.slidebg.recents";
function ColorControl({
  value, onChange, onApplyAll, onClear,
  label = "Custom colour", seedDefault = "#1f1b16", triggerKind = "bg",
}) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState([]);
  const wrapRef = useRef(null);
  const active = isHex(value);
  const seed = active ? value : (THEMES[value]?.bg || seedDefault);
  const [hex, setHex] = useState(seed);

  useEffect(() => { setHex(seed); }, [seed]);

  useEffect(() => {
    try {
      const r = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
      if (Array.isArray(r)) setRecents(r);
    } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const remember = (v) => {
    const next = [v, ...recents.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8);
    setRecents(next);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const commit = (v) => {
    if (!isHex(v)) return;
    onChange(v);
    remember(v);
  };
  const eyedrop = async () => {
    if (!window.EyeDropper) return;
    try {
      const res = await new window.EyeDropper().open();
      if (res?.sRGBHex) { setHex(res.sRGBHex); commit(res.sRGBHex); }
    } catch { /* cancelled */ }
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={label}
        aria-label={label}
        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition ${
          active ? "border-accent scale-110" : "border-line hover:border-ink"
        }`}
        style={
          triggerKind === "text"
            ? { background: active ? value : "#ffffff" }
            : active
              ? { background: value }
              : { background: "conic-gradient(#c8472b,#e0a04a,#6b7f5a,#2f7d95,#3a2740,#c8472b)" }
        }
      >
        {triggerKind === "text"
          ? <span className="font-serif text-[12px] leading-none" style={{ color: active ? "#fff" : "#1a1814", mixBlendMode: "difference" }}>A</span>
          : !active && <Plus size={11} className="text-white drop-shadow" strokeWidth={3} />}
      </button>

      {open && (
        <div className="absolute z-50 top-8 right-0 w-60 rounded-xl border border-line bg-paper-cool shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted">{label}</p>
            {onClear && (
              <button type="button"
                onClick={() => { onClear(); setOpen(false); }}
                className="text-[10px] text-muted hover:text-ink underline">
                Auto
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="color"
              value={isHex(hex) ? hex : "#1f1b16"}
              onChange={(e) => { setHex(e.target.value); commit(e.target.value); }}
              className="h-9 w-10 rounded border border-line bg-transparent cursor-pointer p-0"
              aria-label="Pick a colour"
            />
            <span className="text-muted text-sm">#</span>
            <input
              value={hex.replace(/^#/, "")}
              onChange={(e) => setHex("#" + e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") commit(hex); }}
              onBlur={() => commit(hex)}
              placeholder="2f7d95"
              className="flex-1 min-w-0 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-ink font-mono"
            />
            {typeof window !== "undefined" && window.EyeDropper && (
              <button type="button" onClick={eyedrop} title="Pick from screen"
                className="h-9 w-9 rounded-lg border border-line bg-paper hover:border-ink flex items-center justify-center text-ink-soft">
                <Search size={13} />
              </button>
            )}
          </div>
          {recents.length > 0 && (
            <>
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted mb-1.5">Recent</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {recents.map((c) => (
                  <button key={c} type="button" onClick={() => { setHex(c); commit(c); }}
                    title={c} aria-label={c}
                    className="h-6 w-6 rounded-full border-2 border-line hover:border-ink transition"
                    style={{ background: c }} />
                ))}
              </div>
            </>
          )}
          {onApplyAll && (
            <button
              type="button"
              onClick={() => { if (isHex(hex)) { onApplyAll(hex); remember(hex); setOpen(false); } }}
              className="w-full text-center text-[12px] py-2 rounded-lg border border-line bg-paper hover:border-ink text-ink-soft"
            >
              Apply to all slides
            </button>
          )}
        </div>
      )}
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
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition" aria-label="Close">
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
