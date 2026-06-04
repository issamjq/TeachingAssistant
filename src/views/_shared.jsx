import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowUp, ArrowDown, ArrowUpDown, X, Pencil, Trash2,
  Calendar, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "../lib/i18n";

const subjectStyles = {
  English: { code: "EN", border: "border-line", text: "text-ink" },
  Math: { code: "MA", border: "border-accent", text: "text-accent" },
  Science: { code: "SC", border: "border-sage", text: "text-sage" },
  Art: { code: "AR", border: "border-gold", text: "text-gold" },
  History: { code: "HI", border: "border-ink", text: "text-ink" },
  Geography: { code: "GE", border: "border-muted", text: "text-muted" },
};

export function SubjectBadge({ subject, size = "md" }) {
  const s =
    subjectStyles[subject] || {
      code: (subject || "—").slice(0, 2).toUpperCase(),
      border: "border-line",
      text: "text-ink",
    };
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-10 w-10 text-[11px]",
    lg: "h-12 w-12 text-xs",
  };
  return (
    <div
      className={`${sizes[size]} ${s.border} ${s.text} bg-paper border rounded-md flex items-center justify-center font-mono font-semibold tracking-wider flex-shrink-0`}
    >
      {s.code}
    </div>
  );
}

const statusStyles = {
  "In progress": { dot: "bg-ink", text: "text-ink-soft" },
  "Ready to use": { dot: "bg-sage", text: "text-sage" },
  Blocked: { dot: "bg-accent", text: "text-accent" },
  Paused: { dot: "bg-muted", text: "text-muted" },
};

export function StatusBadge({ status }) {
  const s = statusStyles[status] || statusStyles.Paused;
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-paper border border-line font-mono text-[10px] uppercase tracking-wider ${s.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

export function Section({ step, title, subtitle, badge, children }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">{step}</p>
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-2xl font-medium text-ink">{title}</h3>
          {badge && (
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-sage rounded">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-sm text-muted mt-1.5">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </CardContent>
    </Card>
  );
}

// Pick the most relevant timestamp on a row and label it.
// "Updated …" when the row was edited after creation, otherwise
// "Created …". Items missing both timestamps return null so the
// card can omit the line entirely instead of showing an empty hint.
// Uses the shared timeAgo() so the wording matches everywhere.
export function fmtRowTimestamp(row) {
  if (!row) return null;
  const created = row.created_at || row.createdAt;
  const updated = row.updated_at || row.updatedAt;
  if (!created && !updated) return null;
  const c = created ? new Date(created).getTime() : 0;
  const u = updated ? new Date(updated).getTime() : 0;
  // Treat updates within 60s of create as "just created" — backends
  // often stamp both columns on insert and a row that's never been
  // edited shouldn't read "Updated 2 hours ago".
  if (u && Math.abs(u - c) > 60 * 1000) {
    return { label: "Updated", value: timeAgo(updated), iso: updated };
  }
  return { label: "Created", value: timeAgo(created || updated), iso: created || updated };
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted flex items-center justify-between gap-3 mb-2">
        <span>{label}</span>
        {hint && <span className="normal-case tracking-normal font-serif italic">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function FilePill({ name, type, size, removable = false }) {
  return (
    <div className="flex items-center gap-3 bg-paper border border-line rounded-lg px-3 py-2">
      <div className="h-9 w-9 rounded bg-ink text-paper-cool font-mono text-[9px] flex items-center justify-center font-bold tracking-wider">
        {type}
      </div>
      <div className="text-left">
        <p className="text-sm font-medium leading-tight text-ink">{name}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-0.5">
          {type} · {size}
        </p>
      </div>
      {removable && (
        <button className="text-muted hover:text-accent ml-2 text-sm">×</button>
      )}
    </div>
  );
}

export const inputClasses =
  "w-full rounded-md border border-line bg-paper focus:border-ink focus:outline-none px-3 py-2.5 text-sm text-ink font-sans";
export const selectClasses = inputClasses + " appearance-none";

// ── DatePicker — one branded calendar used for every date field, so the
// app never falls back to the OS's mismatched native picker. Drop-in
// for <input type="date">: value/onChange are ISO "yyyy-mm-dd" strings
// ("" = empty). Pass `className` (usually inputClasses) to size it.
const DP_ISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DP_PARSE = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const DP_WD = ["M", "T", "W", "T", "F", "S", "S"];

// Months grid — short labels for the month picker view. Localised at
// render time via toLocaleDateString so AR shows Arabic month names.
const DP_MONTH_LABEL = (y, m) =>
  new Date(y, m, 1).toLocaleDateString(undefined, { month: "short" });

export function DatePicker({
  value, onChange, placeholder, className = inputClasses,
  min, max, disabled = false,
}) {
  const t = useT();
  const ph = placeholder || t("dp.placeholder");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = DP_PARSE(value);
  const [view, setView] = useState(() => selected || new Date());
  // "days" → standard calendar grid (default).
  // "months" → 4×3 month grid for the current year — pick a month to
  //   land back on the days view for that month.
  // "years" → 4×3 year grid centered on the current decade — pick a
  //   year to drop into the months view for that year. Lets the
  //   teacher jump from 2026 → 2020 in two taps instead of 72.
  const [mode, setMode] = useState("days");

  useEffect(() => {
    if (open) { setView((selected || new Date())); setMode("days"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const minD = DP_PARSE(min);
  const maxD = DP_PARSE(max);
  const todayKey = DP_ISO(new Date());
  const y = view.getFullYear();
  const m = view.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first
  const start = new Date(y, m, 1 - offset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const outOfRange = (d) =>
    (minD && d < new Date(minD.getFullYear(), minD.getMonth(), minD.getDate())) ||
    (maxD && d > new Date(maxD.getFullYear(), maxD.getMonth(), maxD.getDate()));

  const label = selected
    ? selected.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
    : "";
  const pick = (d) => { onChange?.(DP_ISO(d)); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${className} inline-flex items-center justify-between gap-2 text-left disabled:opacity-50 ${
          !label ? "text-muted" : ""
        }`}
      >
        <span className="truncate">{label || ph}</span>
        <Calendar size={15} className="flex-shrink-0 text-muted" />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1.5 w-[280px] rounded-xl border border-line bg-paper-cool shadow-[0_24px_60px_-20px_rgba(15,20,16,0.4)] p-3.5">
          {/* Header — step depends on the mode. The center label is a
              tappable target that escalates the picker grain: days →
              months → years. Two presses get you anywhere in a decade. */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => {
                if (mode === "days")   setView(new Date(y, m - 1, 1));
                if (mode === "months") setView(new Date(y - 1, m, 1));
                if (mode === "years")  setView(new Date(y - 12, m, 1));
              }}
              className="h-7 w-7 rounded-md text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition"
              aria-label={
                mode === "days"   ? "Previous month"
                : mode === "months" ? "Previous year"
                : "Previous 12 years"
              }
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "days" ? "months" : mode === "months" ? "years" : "days")}
              className="font-serif text-[15px] font-medium text-ink hover:text-accent transition px-3 py-0.5 rounded-md"
              aria-label="Switch picker grain"
            >
              {mode === "days" &&
                view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              {mode === "months" && y}
              {mode === "years" && (() => {
                const base = Math.floor(y / 12) * 12;
                return `${base} – ${base + 11}`;
              })()}
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode === "days")   setView(new Date(y, m + 1, 1));
                if (mode === "months") setView(new Date(y + 1, m, 1));
                if (mode === "years")  setView(new Date(y + 12, m, 1));
              }}
              className="h-7 w-7 rounded-md text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition"
              aria-label={
                mode === "days"   ? "Next month"
                : mode === "months" ? "Next year"
                : "Next 12 years"
              }
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {mode === "days" && (
            <>
              <div className="grid grid-cols-7 mb-1">
                {DP_WD.map((d, i) => (
                  <span key={i} className="text-center font-mono text-[9px] uppercase tracking-[0.1em] text-muted py-1">
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((d, i) => {
                  const key = DP_ISO(d);
                  const inMonth = d.getMonth() === m;
                  const isToday = key === todayKey;
                  const isSel = selected && key === DP_ISO(selected);
                  const blocked = outOfRange(d);
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={blocked}
                      onClick={() => pick(d)}
                      className={`h-8 rounded-md text-[12.5px] flex items-center justify-center transition ${
                        isSel
                          ? "bg-accent text-paper-cool font-semibold"
                          : isToday
                            ? "bg-accent/[0.12] text-accent font-semibold"
                            : inMonth
                              ? "text-ink-soft hover:bg-paper-warm"
                              : "text-muted/45 hover:bg-paper-warm"
                      } ${blocked ? "opacity-30 cursor-not-allowed hover:bg-transparent" : ""}`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mode === "months" && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, mi) => {
                const isCur = mi === m;
                const isSelMonth = selected && selected.getFullYear() === y && selected.getMonth() === mi;
                return (
                  <button
                    key={mi}
                    type="button"
                    onClick={() => { setView(new Date(y, mi, 1)); setMode("days"); }}
                    className={`h-10 rounded-md text-[12.5px] flex items-center justify-center transition ${
                      isSelMonth
                        ? "bg-accent text-paper-cool font-semibold"
                        : isCur
                          ? "bg-accent/[0.12] text-accent font-semibold"
                          : "text-ink-soft hover:bg-paper-warm"
                    }`}
                  >
                    {DP_MONTH_LABEL(y, mi)}
                  </button>
                );
              })}
            </div>
          )}

          {mode === "years" && (
            <div className="grid grid-cols-3 gap-1">
              {(() => {
                const base = Math.floor(y / 12) * 12;
                const todayY = new Date().getFullYear();
                return Array.from({ length: 12 }, (_, yi) => {
                  const yy = base + yi;
                  const isCur = yy === y;
                  const isToday = yy === todayY;
                  const isSelYear = selected && selected.getFullYear() === yy;
                  return (
                    <button
                      key={yy}
                      type="button"
                      onClick={() => { setView(new Date(yy, m, 1)); setMode("months"); }}
                      className={`h-10 rounded-md text-[12.5px] flex items-center justify-center transition ${
                        isSelYear
                          ? "bg-accent text-paper-cool font-semibold"
                          : isCur || isToday
                            ? "bg-accent/[0.12] text-accent font-semibold"
                            : "text-ink-soft hover:bg-paper-warm"
                      }`}
                    >
                      {yy}
                    </button>
                  );
                });
              })()}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-line/60">
            <button
              type="button"
              onClick={() => { onChange?.(""); setOpen(false); }}
              className="text-[12px] text-muted hover:text-ink transition"
            >
              {t("dp.clear")}
            </button>
            <button
              type="button"
              onClick={() => { const d = new Date(); setView(d); setMode("days"); pick(d); }}
              className="text-[12px] text-accent hover:text-ink font-serif italic transition"
            >
              {t("dp.today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function timeAgo(timestamp) {
  if (!timestamp) return "—";
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(timestamp).toLocaleDateString();
}

// --- CRUD primitives -------------------------------------------------------

// Toggle sort state for a table. Click a column to sort asc → desc → cleared.
// `getValue` lets us sort on derived fields (computed age, joined name, etc.)
// without storing them on the row.
export function useSortable(rows, { defaultKey = null, defaultDir = "asc", getValue } = {}) {
  const [sort, setSort] = useState(
    defaultKey ? { key: defaultKey, dir: defaultDir } : null
  );

  const toggle = (key) => {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = getValue || ((r, k) => r[k]);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a, sort.key);
      const bv = get(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }, [rows, sort, getValue]);

  return { sorted, sort, toggle, setSort };
}

// Clickable <th> header. Renders the same mono uppercase look as the existing
// table headers, plus an arrow that reflects current sort state.
export function SortHeader({ label, sortKey, sort, onToggle, className = "", padding = "py-3" }) {
  const isActive = sort?.key === sortKey;
  const Icon = !isActive ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`text-left ${padding} font-medium ${className}`}>
      <button
        onClick={() => onToggle(sortKey)}
        className={`inline-flex items-center gap-1.5 transition ${
          isActive ? "text-ink" : "hover:text-ink"
        }`}
      >
        {label}
        <Icon size={11} className={isActive ? "opacity-100" : "opacity-40"} />
      </button>
    </th>
  );
}

// Modal shell. Click backdrop or × to close. Escape also closes.
export function Modal({ open, onClose, title, eyebrow, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-start justify-center p-4 md:p-10 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`bg-paper-cool border border-line rounded-xl shadow-lg w-full ${
          wide ? "max-w-3xl" : "max-w-xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-line">
          <div>
            {eyebrow && (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 inline-flex items-center gap-2.5">
                <span className="w-6 h-px bg-accent" /> {eyebrow}
              </p>
            )}
            <h3 className="font-serif text-2xl font-medium text-ink">{title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-md text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-paper">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Yes/No confirmation modal for delete actions. Caller drives loading state.
export function ConfirmDelete({ open, onClose, onConfirm, title, message, busy = false }) {
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t("confirm.eyebrow")}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? t("common.deleting") : t("common.delete")}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{message}</p>
      <p className="text-xs text-muted mt-3">{t("common.cantUndo")}</p>
    </Modal>
  );
}

// Inline edit/delete buttons for a table row.
export function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1">
      {onEdit && (
        <button
          onClick={onEdit}
          title="Edit"
          className="h-7 w-7 rounded-md border border-line hover:border-ink hover:bg-paper-warm flex items-center justify-center text-ink-soft transition"
        >
          <Pencil size={12} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          title="Delete"
          className="h-7 w-7 rounded-md border border-line hover:border-accent hover:bg-paper-warm flex items-center justify-center text-ink-soft hover:text-accent transition"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

// Inline editor for an array of `{ name, url }` attachment refs.
// We don't host file uploads — paste a URL (Google Drive, OneDrive, etc.).
export function AttachmentsList({ value = [], onChange }) {
  const update = (i, patch) =>
    onChange(value.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...(value || []), { name: "", url: "" }]);

  return (
    <div className="space-y-2">
      {(value || []).map((a, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            placeholder="Label (e.g. Worksheet)"
            value={a.name || ""}
            onChange={(e) => update(i, { name: e.target.value })}
            className={`${inputClasses} max-w-[40%]`}
          />
          <input
            placeholder="https://…"
            value={a.url || ""}
            onChange={(e) => update(i, { url: e.target.value })}
            className={inputClasses}
          />
          <button
            onClick={() => remove(i)}
            className="text-muted hover:text-accent"
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-accent hover:text-ink font-serif italic text-sm border-b border-accent hover:border-ink transition"
      >
        + Add attachment
      </button>
    </div>
  );
}

// Tag-style multi-select. Click a chip to toggle. Used for teacher majors
// and grade_levels in the edit form.
//
// When `allowCustom` is true, the user can also type a value not in the
// curated `options` list. Custom values render alongside the togglable
// chips (with a × to remove) and are kept in `value` even though they
// aren't in `options`. Order in the returned array follows: curated picks
// first (in the order of `options`), then custom values appended.
export function ChipMultiSelect({ value = [], onChange, options, allowCustom = false, customPlaceholder = "Add custom…" }) {
  const set = new Set(value);
  const optionSet = new Set(options);
  const customs = value.filter((v) => !optionSet.has(v));
  const [draft, setDraft] = useState("");

  const commit = (next) => {
    // Re-derive ordering: curated first (in canonical order), then customs.
    const canonical = options.filter((o) => next.has(o));
    const extra = [...next].filter((v) => !optionSet.has(v));
    onChange([...canonical, ...extra]);
  };

  const addCustom = () => {
    const v = draft.trim();
    if (!v) return;
    if (set.has(v)) {
      setDraft("");
      return;
    }
    const next = new Set(set);
    next.add(v);
    commit(next);
    setDraft("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = set.has(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => {
                const next = new Set(set);
                if (active) next.delete(opt);
                else next.add(opt);
                commit(next);
              }}
              className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider border transition ${
                active
                  ? "bg-ink text-paper-cool border-ink"
                  : "bg-paper text-ink-soft border-line hover:border-ink"
              }`}
            >
              {opt}
            </button>
          );
        })}
        {customs.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider border bg-accent/10 text-accent border-accent"
          >
            {v}
            <button
              type="button"
              onClick={() => {
                const next = new Set(set);
                next.delete(v);
                commit(next);
              }}
              className="hover:text-ink"
              title="Remove"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      {allowCustom && (
        <div className="mt-3 flex items-center gap-2 max-w-xs">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder={customPlaceholder}
            className={`${inputClasses} py-1.5 text-xs`}
          />
          <Button variant="secondary" onClick={addCustom} disabled={!draft.trim()} className="px-3 py-1.5 text-xs">
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

// Throw-anything fetch helper that throws on non-2xx so callers can `try`.
// Returns parsed JSON; pass null for body on GET/DELETE.
//
// In dev, VITE_API_URL is unset so requests go to the same origin and hit
// Vite's mounted Express app. In production, set VITE_API_URL on Vercel to
// the Render backend URL (e.g. https://murchid-api.onrender.com) and every
// /api/* call will be redirected there.
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Pulls the signed-in teacher's classes (grade_levels + sections) so
// every new-entry form (Quizzes / Homework / Presentations / Schedule)
// only offers what THIS teacher actually teaches — set in My students
// → Teaching profile. Returns empty arrays while loading or on error.
export function useTeacherClasses() {
  const [data, setData] = useState({ grades: [], sections: [] });
  useEffect(() => {
    let alive = true;
    api("/api/me")
      .then((me) => {
        if (!alive) return;
        setData({
          grades: Array.isArray(me?.grade_levels) ? me.grade_levels : [],
          sections: Array.isArray(me?.sections) ? me.sections : [],
        });
      })
      .catch(() => { /* silent — dropdowns just show their fallback */ });
    return () => { alive = false; };
  }, []);
  return data;
}

export async function api(path, { method = "GET", body } = {}) {
  // Lazy-load the auth helper so files that import api from a non-React
  // context (init scripts, tests) don't pull Firebase into their bundle.
  const { getIdToken } = await import("../lib/firebaseAuth");
  const token = await getIdToken().catch(() => null);

  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty response */
  }
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data;
}
