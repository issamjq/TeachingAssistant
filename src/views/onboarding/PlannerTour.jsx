"use client";

// First-run walkthrough that appears the first time a teacher lands on
// the Planner. A spotlight coachmark: each step dims the screen, cuts a
// hole around a real sidebar element (the Studio launcher, a nav tab, the
// account chip), and floats an explainer card beside it. Next advances
// the spotlight to the following element. Persists a "seen" flag in
// localStorage so it only ever runs once per device.
//
// On narrow screens the sidebar is an off-canvas drawer, so there's
// nothing to spotlight — we fall back to a centered card carrying the
// same copy.
import React, { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, CalendarDays, UserCircle2, BookOpen, GraduationCap,
  ChevronRight, X,
} from "lucide-react";
import { useT, useI18n } from "../../lib/i18n";

const SEEN_KEY = "murchid.tour.planner.seen";

// Each step points at a real element via its data-tour attribute. Order
// follows the rail top-to-bottom: nav tabs, the Studio launcher, then the
// account chip at the foot.
const STEPS = [
  { id: "planner",  icon: CalendarDays,  selector: '[data-tour="nav-planner"]',      eyebrow: "01" },
  { id: "lesson",   icon: BookOpen,      selector: '[data-tour="nav-lesson-plans"]', eyebrow: "02" },
  { id: "students", icon: GraduationCap, selector: '[data-tour="nav-database"]',      eyebrow: "03" },
  { id: "studio",   icon: Sparkles,      selector: '[data-tour="studio"]',           eyebrow: "04" },
  { id: "menu",     icon: UserCircle2,   selector: '[data-tour="account"]',          eyebrow: "05" },
];

export const hasSeenPlannerTour = () => {
  try { return localStorage.getItem(SEEN_KEY) === "1"; }
  catch { return false; }
};
export const markPlannerTourSeen = () => {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
};

const PAD = 6;        // breathing room around the spotlit element
const CARD_W = 340;   // explainer card width

export default function PlannerTour({ open, onClose }) {
  const t = useT();
  const { dir } = useI18n();
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);

  const step = STEPS[idx];
  const last = idx === STEPS.length - 1;

  const finish = () => {
    markPlannerTourSeen();
    onClose?.();
  };

  useEffect(() => { if (open) setIdx(0); }, [open]);

  // Measure the current target. Recompute on resize/scroll and whenever
  // the step changes. A small delay lets the target scroll into view
  // first. On phones (no visible sidebar) the target has no box → null,
  // which triggers the centered fallback.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = document.querySelector(step.selector);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) { setRect(null); return; }
      // The sidebar drawer is off-canvas below md; treat off-screen
      // targets as "not visible" so we don't point at nothing.
      if (r.right < 0 || r.left > window.innerWidth) { setRect(null); return; }
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, idx, step.selector]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") finish();
      else if (e.key === "Enter" || e.key === "ArrowRight") (last ? finish() : setIdx((i) => i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, last]);

  if (!open) return null;
  const Icon = step.icon;

  // Card position: float to the right of the spotlit element when there's
  // room, otherwise to its left; clamp vertically into the viewport.
  let cardStyle;
  if (rect) {
    let left = rect.left + rect.width + 16;
    if (left + CARD_W > window.innerWidth - 12) {
      left = Math.max(12, rect.left - CARD_W - 16);
    }
    let top = rect.top - 8;
    top = Math.min(top, window.innerHeight - 240);
    top = Math.max(12, top);
    cardStyle = { position: "fixed", left, top, width: CARD_W };
  }

  const Card = (
    <div
      className="studio-menu-rise bg-paper-cool rounded-2xl shadow-2xl border border-line overflow-hidden"
      style={cardStyle}
    >
      <button
        type="button"
        onClick={finish}
        aria-label={t("tour.skip")}
        className="absolute top-3 end-3 z-10 h-8 w-8 rounded-md text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition-colors"
      >
        <X size={16} />
      </button>

      <div className="px-6 pt-6 pb-5">
        <span className="inline-flex h-11 w-11 rounded-xl bg-accent/10 text-accent items-center justify-center mb-3.5">
          <Icon size={20} strokeWidth={2} />
        </span>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">
          {t("tour.stepOf", { n: step.eyebrow, total: String(STEPS.length).padStart(2, "0") })}
        </p>
        <h3 className="font-serif text-xl font-medium text-ink leading-tight mb-2">
          {t(`tour.${step.id}.title`)}
        </h3>
        <p className="text-sm text-ink-soft leading-relaxed">
          {t(`tour.${step.id}.body`)}
        </p>
      </div>

      <div className="px-6 py-3.5 border-t border-line bg-paper flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-accent" : "w-1.5 bg-line"}`}
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
  );

  return createPortal(
    <div className="fixed inset-0 z-[300]" role="dialog" aria-modal="true" dir={dir}>
      {rect ? (
        <>
          {/* Click-catcher: backdrop dimming is done by the highlight's
              giant box-shadow, so this layer is transparent and only
              swallows clicks outside the spotlight. */}
          <div className="absolute inset-0" onClick={finish} />
          {/* The spotlight — a transparent box with a 9999px shadow that
              dims everything except the cut-out, plus an accent ring. */}
          <div
            className="absolute rounded-xl ring-2 ring-accent pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              left: rect.left - PAD,
              top: rect.top - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: "0 0 0 9999px rgba(26,24,20,0.62)",
            }}
          />
          {Card}
        </>
      ) : (
        // Fallback (phones / drawer collapsed): centered card over a dim.
        <>
          <div className="absolute inset-0 bg-ink/55 backdrop-blur-sm" onClick={finish} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="relative w-full max-w-[440px]">{Card}</div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
