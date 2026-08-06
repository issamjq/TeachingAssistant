"use client";

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
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "../shared/hooks/useMounted";
import { Plus, X, Pencil, Trash2, LayoutGrid, List, Sparkles, RotateCcw, ArrowUpDown, Calendar as CalendarIcon } from "lucide-react";
import { useT } from "../lib/i18n";
import { navigate } from "../lib/route";
import { api, DatePicker } from "./_shared";

// Shared toolbar chip class so every action button in the page header
// (sort dropdown, date scope, view toggle, recently deleted, +New X,
// any extraActions) is the same h-9 height + same padding. The "GHOST"
// variant is the neutral button look; the base TOOLBAR_CHIP can be
// combined with bg/colour overrides for the primary New button.
const TOOLBAR_CHIP =
  "planner-nav-btn h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-[12px] border leading-none whitespace-nowrap";
const TOOLBAR_CHIP_GHOST =
  `${TOOLBAR_CHIP} border-line bg-paper-cool text-ink hover:bg-paper-warm hover:border-ink`;

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
  const t = useT();
  const btn = (key, label, Icon) => (
    <button
      type="button"
      onClick={() => onChange(key)}
      aria-pressed={mode === key}
      title={`${label} view`}
      className={`planner-nav-btn h-7 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[12px] leading-none transition ${
        mode === key
          ? "bg-ink text-paper-cool"
          : "text-ink hover:bg-paper-warm"
      }`}
    >
      <Icon size={12} strokeWidth={2} />
      {label}
    </button>
  );
  return (
    <div className="h-9 inline-flex items-center gap-1 px-1 rounded-lg border border-line bg-paper-cool">
      {btn("cards", t("dv.cards"), LayoutGrid)}
      {btn("list",  t("dv.list"),  List)}
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
  // Trash / recovery — when an endpoint is provided, the header shows
  // a "Recently deleted" button that opens TrashPopup.
  trashEndpoint,      // e.g., "/api/quizzes"
  trashTitleField = "title",  // some tables (drafts/templates) use "name"
  onTrashChange,      // () => void  callback fired after restore/forever
  // Sort + date-range scope. Both are optional — when omitted, the
  // controls don't render.
  sortOptions,        // [{ value, label }] for the sort <select>
  sortKey,
  onSortChange,
  dateScope,          // { mode: "all"|"week"|"month"|"custom", from, to }
  onDateScopeChange,
}) {
  const t = useT();
  const [popupOpen, setPopupOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  return (
    <div className="mb-6">
      {/* Row 1 — eyebrow + serif title + caption. Always its own row
          so the heading can breathe; action chips drop to row 2 below. */}
      <div className="mb-4">
        {eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {eyebrow}
          </p>
        )}
        <h2 className="font-serif text-4xl font-medium text-ink leading-tight">
          {title}
        </h2>
        {subtitle && <p className="text-muted mt-2 max-w-2xl">{subtitle}</p>}
      </div>

      {/* Row 2 — action cluster. Every chip is the same height (h-9)
          and uses the same padding family so the row reads as one
          unit. The New X button stays visually distinct via colour
          (filled ink), not size. */}
      <div className="flex flex-wrap items-center gap-2">
        {sortOptions && onSortChange && (
          <label className={`${TOOLBAR_CHIP_GHOST} cursor-pointer pr-2`}>
            <ArrowUpDown size={12} strokeWidth={2} className="text-muted" />
            <select
              value={sortKey || ""}
              onChange={(e) => onSortChange(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-ink leading-none"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
        {dateScope && onDateScopeChange && (
          <DateScopePicker
            scope={dateScope}
            onChange={onDateScopeChange}
            open={scopeOpen}
            onToggle={() => setScopeOpen((v) => !v)}
            onClose={() => setScopeOpen(false)}
          />
        )}
        {onModeChange && <ViewModeToggle mode={mode} onChange={onModeChange} />}
        {extraActions}
        {trashEndpoint && (
          <button
            type="button"
            onClick={() => setTrashOpen(true)}
            title="See items you recently deleted"
            className={TOOLBAR_CHIP_GHOST}
          >
            <Trash2 size={12} strokeWidth={2} />
            {t("dv.recentlyDeleted")}
          </button>
        )}
        {newLabel && onNewManual && (
          <button
            type="button"
            onClick={() => (aiKind ? setPopupOpen(true) : onNewManual())}
            className={`${TOOLBAR_CHIP} ml-auto bg-ink text-paper-cool font-medium hover:bg-ink-soft border-ink`}
          >
            <Plus size={13} strokeWidth={2.25} />
            {newLabel}
          </button>
        )}
      </div>
      {popupOpen && (
        <NewKindPopup
          kind={newLabel}
          aiKind={aiKind}
          onClose={() => setPopupOpen(false)}
          onManual={() => { setPopupOpen(false); onNewManual?.(); }}
        />
      )}
      {trashOpen && trashEndpoint && (
        <TrashPopup
          endpoint={trashEndpoint}
          titleField={trashTitleField}
          onClose={() => setTrashOpen(false)}
          onChange={onTrashChange}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// TrashPopup — shows soft-deleted items (last 30 days), with
// Restore + Delete-forever per row. Endpoint is the resource base
// (e.g., "/api/quizzes"); we hit /trash, /:id/restore, /:id/forever.
// ──────────────────────────────────────────────────────────────────
export function TrashPopup({ endpoint, titleField = "title", onClose, onChange }) {
  const mounted = useMounted();
  const t = useT();
  const [rows, setRows] = useState(null);  // null = loading
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

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

  const reload = () => {
    setRows(null);
    setErr(null);
    api(`${endpoint}/trash`)
      .then((data) => setRows(data || []))
      .catch((e) => { setRows([]); setErr(e.message); });
  };
  useEffect(reload, [endpoint]);

  const restore = async (id) => {
    setBusyId(id);
    try {
      await api(`${endpoint}/${id}/restore`, { method: "POST" });
      setRows((rs) => (rs || []).filter((r) => r.id !== id));
      onChange?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const forever = async (id) => {
    if (!window.confirm(t("trash.confirmForever"))) return;
    setBusyId(id);
    try {
      await api(`${endpoint}/${id}/forever`, { method: "DELETE" });
      setRows((rs) => (rs || []).filter((r) => r.id !== id));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const daysLeft = (deletedAt) => {
    const ms = new Date(deletedAt).getTime() + 30 * 86400000 - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  };

  // Portals cannot be server-rendered — see useMounted().
  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/45 backdrop-blur-lg backdrop-saturate-150 animate-[fadeIn_180ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="relative bg-paper-cool rounded-2xl border border-line shadow-[0_30px_80px_-20px_rgba(15,20,16,0.45)] w-full max-w-[720px] max-h-[85vh] flex flex-col animate-[popIn_220ms_cubic-bezier(0.22,1,0.36,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 h-9 w-9 rounded-lg text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition"
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        <div className="px-7 pt-6 pb-5 border-b border-line pr-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {t("trash.title")}
          </p>
          <h2 className="font-serif text-2xl font-medium text-ink leading-tight">
            {t("dv.recentlyDeleted")}
          </h2>
          <p className="text-[12.5px] text-muted mt-1.5">
            {t("trash.note")}
          </p>
        </div>

        <div className="px-6 py-5 overflow-auto">
          {err && (
            <div className="mb-3 bg-paper border border-accent rounded-lg p-2.5">
              <p className="text-sm text-accent">{err}</p>
            </div>
          )}

          {rows === null && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{t("common.loading")}</p>
          )}

          {rows && rows.length === 0 && !err && (
            <p className="text-center text-muted text-sm py-8">
              {t("trash.empty")}
            </p>
          )}

          {rows && rows.length > 0 && (
            <div className="flex flex-col gap-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-line bg-[#fdf8ee]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink leading-tight truncate">
                      {r[titleField] || "(untitled)"}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      Deleted {new Date(r.deleted_at).toLocaleDateString()} · {daysLeft(r.deleted_at)} day{daysLeft(r.deleted_at) === 1 ? "" : "s"} left
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => restore(r.id)}
                    disabled={busyId === r.id}
                    className="planner-nav-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-sage/40 bg-paper-cool hover:bg-sage hover:text-paper-cool hover:border-sage text-[12px] text-sage disabled:opacity-50"
                  >
                    <RotateCcw size={12} strokeWidth={2} /> {t("trash.restore")}
                  </button>
                  <button
                    type="button"
                    onClick={() => forever(r.id)}
                    disabled={busyId === r.id}
                    className="planner-nav-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-accent/40 bg-paper-cool hover:bg-accent hover:text-paper-cool hover:border-accent text-[12px] text-accent disabled:opacity-50"
                  >
                    <Trash2 size={12} strokeWidth={2} /> {t("trash.deleteForever")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ──────────────────────────────────────────────────────────────────
// Date-scope picker (All / This week / This month / Custom range)
// ──────────────────────────────────────────────────────────────────

const SCOPE_KEY = { all: "dv.allTime", week: "dv.thisWeek", month: "dv.thisMonth", custom: "dv.customRange" };

function DateScopePicker({ scope, onChange, open, onToggle, onClose }) {
  const t = useT();
  const sl = (m) => t(SCOPE_KEY[m] || "dv.allTime");
  const label = scope.mode === "custom"
    ? (scope.from && scope.to
        ? `${scope.from.slice(5)} → ${scope.to.slice(5)}`
        : t("dv.customRange"))
    : sl(scope.mode);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={TOOLBAR_CHIP_GHOST}
      >
        <CalendarIcon size={12} strokeWidth={2} className="text-muted" />
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <div className="absolute right-0 mt-1.5 z-40 w-[260px] rounded-xl border border-line bg-paper-cool shadow-[0_18px_44px_-18px_rgba(15,20,16,0.32)] p-2">
            {["all", "week", "month", "custom"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onChange({ ...scope, mode: m });
                  if (m !== "custom") onClose();
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12.5px] ${
                  scope.mode === m ? "bg-accent/[0.10] text-accent" : "text-ink hover:bg-paper-warm"
                }`}
              >
                {sl(m)}
              </button>
            ))}
            {scope.mode === "custom" && (
              <div className="mt-2 pt-2 border-t border-line flex flex-col gap-2">
                <label className="text-[10px] uppercase tracking-wider text-muted">
                  {t("dv.from")}
                  <div className="mt-0.5">
                    <DatePicker
                      value={scope.from || ""}
                      onChange={(v) => onChange({ ...scope, from: v })}
                      className="block w-full rounded-md border border-line bg-paper px-2 py-1 text-[12px] text-ink"
                    />
                  </div>
                </label>
                <label className="text-[10px] uppercase tracking-wider text-muted">
                  {t("dv.to")}
                  <div className="mt-0.5">
                    <DatePicker
                      value={scope.to || ""}
                      onChange={(v) => onChange({ ...scope, to: v })}
                      className="block w-full rounded-md border border-line bg-paper px-2 py-1 text-[12px] text-ink"
                    />
                  </div>
                </label>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Helper — used by every surface to filter items by the chosen date
// scope. `getDate` returns the item's date string ("YYYY-MM-DD") or
// null when the item carries no date (those are kept under "all" and
// hidden under any other scope so a custom window doesn't quietly
// surface untimed rows).
export function useDateScope(initial = { mode: "all", from: "", to: "" }) {
  const [scope, setScope] = useState(initial);
  const range = useMemo(() => computeScopeRange(scope), [scope]);
  return [scope, setScope, range];
}

function computeScopeRange(scope) {
  if (!scope || scope.mode === "all") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (scope.mode === "week") {
    const day = (today.getDay() + 6) % 7; // Mon = 0
    const from = new Date(today); from.setDate(today.getDate() - day);
    const to = new Date(from); to.setDate(from.getDate() + 6);
    return { from: isoDay(from), to: isoDay(to) };
  }
  if (scope.mode === "month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: isoDay(from), to: isoDay(to) };
  }
  if (scope.mode === "custom") {
    if (!scope.from || !scope.to) return null;
    return { from: scope.from, to: scope.to };
  }
  return null;
}
function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function filterByDateScope(items, range, getDate) {
  if (!range) return items;
  return items.filter((it) => {
    const v = getDate(it);
    if (!v) return false;
    const iso = String(v).slice(0, 10);
    return iso >= range.from && iso <= range.to;
  });
}

// ──────────────────────────────────────────────────────────────────
// "How do you want to create this?" popup
// ──────────────────────────────────────────────────────────────────
export function NewKindPopup({ kind, aiKind, onClose, onManual }) {
  const mounted = useMounted();
  const t = useT();
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

  // Portals cannot be server-rendered — see useMounted().
  if (!mounted) return null;
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
          className="absolute top-4 right-4 z-10 h-9 w-9 rounded-lg text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition"
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        <div className="px-7 pt-6 pb-5 border-b border-line">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {t("dv.create")}
          </p>
          <h2 className="font-serif text-2xl font-medium text-ink leading-tight">
            {t("dv.howA")}
            <em className="italic font-medium text-accent">
              {kind?.toLowerCase().replace(/^new\s+/, "") || t("dv.create").toLowerCase()}
            </em>
            {t("dv.howB")}
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
              {t("dv.manually")}
            </span>
            <span className="text-[11.5px] text-muted leading-snug">
              {t("dv.manuallyDesc")}
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
              {t("dv.withAI")}
            </span>
            <span className="text-[11.5px] text-muted leading-snug">
              {t("dv.withAIDesc")}
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
// `timestamp` shows a small "Created …" / "Updated …" footer pinned
// to the bottom of the card. Accepts either the helper's
// { label, value, iso } object or a plain string for legacy call
// sites. Renders nothing when null so cards that don't track it (or
// rows with no timestamps yet) keep their layout.
export function DataCard({ onEdit, onDelete, exportNode, className = "", children, timestamp }) {
  return (
    <div
      className={`relative rounded-2xl border border-[#e6dccb] bg-paper-cool shadow-[0_18px_44px_-22px_rgba(15,20,16,0.14)] hover:border-ink/30 hover:shadow-[0_22px_50px_-22px_rgba(15,20,16,0.22)] transition-all duration-200 p-5 flex flex-col ${className}`}
    >
      <div className="absolute top-3 right-3 flex items-center gap-1">
        {exportNode}
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
      {timestamp && (
        <p
          className="mt-3 pt-2 border-t border-dashed border-line/70 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted/80"
          title={typeof timestamp === "object" && timestamp.iso ? new Date(timestamp.iso).toLocaleString() : undefined}
        >
          {typeof timestamp === "object"
            ? <>{timestamp.label} <span className="text-ink-soft normal-case tracking-normal font-serif italic ms-1">{timestamp.value}</span></>
            : timestamp}
        </p>
      )}
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
