// Shared building blocks for the Teaching surfaces (Templates, Drafts,
// Quizzes, Homework, Presentations, Activities) so they all look and
// behave the same:
//   - DataPageHeader: eyebrow + title + subtitle + view toggle + the
//     "+ New X" pill that opens NewKindPopup.
//   - NewKindPopup: asks the teacher whether they want to create
//     manually (current per-section modal) or jump to Studio AI.
//   - ViewModeToggle + useViewMode: cards ↔ list switch, persisted per
//     surface in localStorage.
//   - DataCard: shared card wrapper with always-visible edit + delete
//     icons in the top-right corner.
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Pencil, Trash2, LayoutGrid, List, Sparkles } from "lucide-react";
import { navigate } from "../lib/route";

// ──────────────────────────────────────────────────────────────────
// View mode persistence
// ──────────────────────────────────────────────────────────────────
export function useViewMode(storageKey, fallback = "cards") {
  const [mode, setMode] = useState(() => {
    try {
      const v = localStorage.getItem(storageKey);
      return v === "cards" || v === "list" ? v : fallback;
    } catch { return fallback; }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, mode); } catch { /* ignore */ }
  }, [storageKey, mode]);
  return [mode, setMode];
}

// ──────────────────────────────────────────────────────────────────
// Cards ↔ List pill
// ──────────────────────────────────────────────────────────────────
export function ViewModeToggle({ mode, onChange }) {
  const btn = (key, label, Icon) => (
    <button
      type="button"
      onClick={() => onChange(key)}
      aria-pressed={mode === key}
      title={`${label} view`}
      className={`planner-nav-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] transition ${
        mode === key
          ? "bg-ink text-paper-cool"
          : "text-ink hover:bg-paper-warm"
      }`}
    >
      <Icon size={13} strokeWidth={2} />
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-line bg-paper-cool">
      {btn("cards", "Cards", LayoutGrid)}
      {btn("list",  "List",  List)}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Page header — eyebrow, title (with italic accent split), subtitle,
// optional extra-actions slot, view toggle, and the "+ New X" pill.
// ──────────────────────────────────────────────────────────────────
export function DataPageHeader({
  eyebrow,
  title,              // ReactNode — usually <>Quizzes & <em>exams</em></>
  subtitle,
  newLabel,           // e.g., "New quiz"
  onNewManual,        // () => void; called when the user picks "Manually"
  aiKind,             // Studio kind to pre-select when picking "With Studio AI"
  mode,               // "cards" | "list"
  onModeChange,       // (m) => void
  extraActions,       // ReactNode — sits to the left of the New button
}) {
  const [popupOpen, setPopupOpen] = useState(false);
  return (
    <div className="mb-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
              <span className="w-6 h-px bg-accent" /> {eyebrow}
            </p>
          )}
          <h2 className="font-serif text-4xl font-medium text-ink leading-tight">
            {title}
          </h2>
          {subtitle && <p className="text-muted mt-2">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onModeChange && <ViewModeToggle mode={mode} onChange={onModeChange} />}
          {extraActions}
          {newLabel && onNewManual && (
            <button
              type="button"
              onClick={() => setPopupOpen(true)}
              className="planner-nav-btn inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ink text-paper-cool text-sm font-medium hover:bg-ink-soft"
            >
              <Plus size={15} strokeWidth={2.25} />
              {newLabel}
            </button>
          )}
        </div>
      </div>
      {popupOpen && (
        <NewKindPopup
          kind={newLabel}
          aiKind={aiKind}
          onClose={() => setPopupOpen(false)}
          onManual={() => { setPopupOpen(false); onNewManual?.(); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// "How do you want to create this?" popup
// ──────────────────────────────────────────────────────────────────
export function NewKindPopup({ kind, aiKind, onClose, onManual }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const onAi = () => {
    onClose();
    navigate(aiKind ? ["studio", aiKind] : ["studio"]);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/45 backdrop-blur-lg backdrop-saturate-150 animate-[fadeIn_180ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative bg-paper-cool rounded-2xl border border-line shadow-[0_30px_80px_-20px_rgba(15,20,16,0.45)] w-full max-w-[640px] animate-[popIn_220ms_cubic-bezier(0.22,1,0.36,1)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 h-9 w-9 rounded-lg border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink flex items-center justify-center transition-all"
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        <div className="px-7 pt-6 pb-5 border-b border-line">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Create
          </p>
          <h2 className="font-serif text-2xl font-medium text-ink leading-tight">
            How would you like to <em className="italic font-medium text-accent">{kind?.toLowerCase().replace(/^new\s+/, "") || "create"}</em>?
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 p-6">
          <button
            type="button"
            onClick={onManual}
            className="planner-nav-btn flex flex-col items-start gap-2 text-left p-4 rounded-xl border border-line bg-[#fdf8ee] hover:border-ink/40"
          >
            <span className="inline-flex h-9 w-9 rounded-lg bg-ink/[0.08] text-ink items-center justify-center">
              <Pencil size={16} strokeWidth={2.25} />
            </span>
            <span className="font-serif text-[15px] font-medium text-ink leading-tight">
              Manually
            </span>
            <span className="text-[11.5px] text-muted leading-snug">
              Fill in the fields yourself. Best when you already know what you want.
            </span>
          </button>

          <button
            type="button"
            onClick={onAi}
            className="planner-nav-btn flex flex-col items-start gap-2 text-left p-4 rounded-xl border border-accent/30 bg-accent/[0.08] hover:border-accent/60"
          >
            <span className="inline-flex h-9 w-9 rounded-lg bg-accent/[0.16] text-accent items-center justify-center">
              <Sparkles size={16} strokeWidth={2.25} />
            </span>
            <span className="font-serif text-[15px] font-medium text-ink leading-tight">
              With Studio AI
            </span>
            <span className="text-[11.5px] text-muted leading-snug">
              Describe what you need and let Mudir draft it for you.
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ──────────────────────────────────────────────────────────────────
// Card wrapper — pencil + trash always visible top-right
// ──────────────────────────────────────────────────────────────────
export function DataCard({ onEdit, onDelete, className = "", children }) {
  return (
    <div
      className={`relative rounded-2xl border border-[#e6dccb] bg-paper-cool shadow-[0_18px_44px_-22px_rgba(15,20,16,0.14)] hover:border-ink/30 hover:shadow-[0_22px_50px_-22px_rgba(15,20,16,0.22)] transition-all duration-200 p-5 flex flex-col ${className}`}
    >
      <div className="absolute top-3 right-3 flex items-center gap-1">
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label="Edit"
            title="Edit"
            className="h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink flex items-center justify-center transition"
          >
            <Pencil size={12} strokeWidth={2} className="text-ink-soft" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete"
            title="Delete"
            className="h-7 w-7 rounded-md border border-line bg-paper-cool hover:bg-accent hover:border-accent hover:text-paper-cool text-ink-soft flex items-center justify-center transition"
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// A consistent grid for cards
// ──────────────────────────────────────────────────────────────────
export function CardsGrid({ children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {children}
    </div>
  );
}
