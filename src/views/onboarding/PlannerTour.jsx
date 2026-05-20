// First-run walkthrough that appears the first time a teacher lands on
// the Planner. Five short cards explaining the studio, quick-create
// chips, calendar, quick actions, and the account menu. Each card has
// Next / Skip. Persists a "seen" flag in localStorage so it only ever
// runs once per device.
//
// Kept deliberately simple: centered modal cards rather than DOM
// spotlights, because spotlight overlays need to recompute on resize
// and don't play nicely with our existing scroll containers. The
// teacher gets the same orientation either way.
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, CalendarDays, Wand2, UserCircle2, BookOpen,
  ChevronRight, X,
} from "lucide-react";
import { useT, useI18n } from "../../lib/i18n";

const SEEN_KEY = "murchid.tour.planner.seen";

// Each step is rendered inside the same card shell — just title +
// description + icon. The order matches the natural eye-path through
// the Planner (top-left → centre → top-right → bottom-left).
const STEPS = [
  { id: "studio",   icon: Sparkles,    eyebrow: "01" },
  { id: "create",   icon: Wand2,       eyebrow: "02" },
  { id: "calendar", icon: CalendarDays, eyebrow: "03" },
  { id: "actions",  icon: BookOpen,    eyebrow: "04" },
  { id: "menu",     icon: UserCircle2, eyebrow: "05" },
];

export const hasSeenPlannerTour = () => {
  try { return localStorage.getItem(SEEN_KEY) === "1"; }
  catch { return false; }
};
export const markPlannerTourSeen = () => {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
};

export default function PlannerTour({ open, onClose }) {
  const t = useT();
  const { dir } = useI18n();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") finish(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { if (open) setIdx(0); }, [open]);

  const finish = () => {
    markPlannerTourSeen();
    onClose?.();
  };

  if (!open) return null;
  const step = STEPS[idx];
  const Icon = step.icon;
  const last = idx === STEPS.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      dir={dir}
    >
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-sm" onClick={finish} />
      <div className="relative w-full max-w-[460px] bg-paper-cool rounded-2xl shadow-2xl border border-line overflow-hidden">
        <button
          type="button"
          onClick={finish}
          aria-label={t("tour.skip")}
          className="absolute top-3 end-3 z-10 h-8 w-8 rounded-md text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition-colors"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-7 pb-6">
          <span className="inline-flex h-12 w-12 rounded-xl bg-accent/10 text-accent items-center justify-center mb-4">
            <Icon size={22} strokeWidth={2} />
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">
            {t("tour.stepOf", { n: step.eyebrow, total: String(STEPS.length).padStart(2, "0") })}
          </p>
          <h3 className="font-serif text-2xl font-medium text-ink leading-tight mb-2">
            {t(`tour.${step.id}.title`)}
          </h3>
          <p className="text-sm text-ink-soft leading-relaxed">
            {t(`tour.${step.id}.body`)}
          </p>
        </div>

        <div className="px-6 py-4 border-t border-line bg-paper flex items-center justify-between gap-2">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-5 bg-accent" : "w-1.5 bg-line"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={finish}
              className="text-[12.5px] font-medium text-ink-soft hover:text-ink px-2 py-1.5 transition-colors"
            >
              {t("tour.skip")}
            </button>
            <button
              type="button"
              onClick={() => (last ? finish() : setIdx((i) => i + 1))}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-ink text-paper-cool text-[13px] font-medium hover:bg-ink-soft transition-colors"
            >
              {last ? t("tour.done") : t("tour.next")}
              {!last && <ChevronRight size={14} className="rtl:rotate-180" />}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
