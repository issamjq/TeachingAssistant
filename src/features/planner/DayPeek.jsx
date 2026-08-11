"use client";

// One day, opened from the grid or the ribbon.
//
// Carried over from the old Planner with two corrections. Every row used
// to carry a sage dot whatever it was, so the calendar's colour coding
// stopped at the moment you clicked into it; rows now use the same
// per-kind tint as the cell chip you came from. And the primary button
// hard-coded a terracotta shadow from the pre-firozeh palette, which
// with the current accent glowed the wrong colour entirely.
import React from "react";
import { createPortal } from "react-dom";
import { X, Plus, ChevronRight } from "lucide-react";
import { useMounted } from "@/shared/hooks/useMounted";
import { useT } from "@/lib/i18n";
import { KIND_BY_KEY, tintOf } from "./month";

export default function DayPeek({ date, dayEvents, locale, onClose, onSelect, onNew }) {
  const mounted = useMounted();
  const t = useT();

  // Escape closes, and the page behind must not scroll under the dialog.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  const d = new Date(`${date}T00:00:00`);
  const weekday = d.toLocaleDateString(locale, { weekday: "long" });
  const full = d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/45 backdrop-blur-lg backdrop-saturate-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${weekday}, ${full}`}
    >
      <div
        className="relative bg-paper-cool rounded-2xl border border-line shadow-[0_30px_80px_-20px_rgba(15,20,16,0.45)] w-full max-w-[620px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button" onClick={onClose} aria-label="Close"
          className="absolute top-4 end-4 z-10 h-9 w-9 rounded-lg text-ink-soft hover:bg-paper-warm hover:text-ink grid place-items-center transition cursor-pointer"
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        <div className="px-7 pt-6 pb-5 border-b border-line pe-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {t("planner.thisDay")}
          </p>
          <h2 className="font-serif text-2xl font-medium text-ink leading-tight">
            {weekday}, <em className="italic font-medium text-accent">{full}</em>
          </h2>
        </div>

        <div className="px-6 py-5 max-h-[55vh] overflow-auto">
          {dayEvents.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">{t("planner.noEntries")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {dayEvents.map((e) => {
                const kind = KIND_BY_KEY[e.kind];
                // Only schedule entries carry an editable row behind them;
                // the rest are read-only here, so they must not look
                // clickable when clicking does nothing.
                const editable = Boolean(e.raw);
                return (
                  <button
                    key={e.id}
                    type="button"
                    disabled={!editable}
                    onClick={() => editable && onSelect(e.raw)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-line bg-surface text-start transition ${
                      editable ? "hover:border-ink/30 cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <span
                      className="w-[3px] self-stretch rounded-full flex-shrink-0"
                      style={{ background: tintOf(e.kind) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink leading-tight truncate">{e.title}</p>
                      <p className="text-[11px] text-muted mt-0.5 truncate">
                        {[kind?.label, e.time || t("planner.allDay"), e.raw?.subject, e.raw?.section]
                          .filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {editable && <ChevronRight size={14} className="text-muted flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line bg-paper/60 flex justify-end">
          <button
            type="button"
            onClick={onNew}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-on-accent text-sm font-semibold hover:bg-accent-hover transition cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            {t("planner.newEntry")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
