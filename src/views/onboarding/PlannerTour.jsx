// First-run walkthrough that appears when a teacher lands on the Planner.
// A spotlight coachmark: each step dims the screen, cuts a hole around a
// real sidebar element, and floats an explainer card beside it.
//
// Four things here are load-bearing and were previously wrong:
//
//   1. The sidebar nav SCROLLS. Targets below the fold measured at their
//      clipped position, so the ring landed on whatever happened to sit
//      there — the card said "My students" while the spotlight was on the
//      Studio launcher. Every target is now scrolled into view before it
//      is measured.
//   2. The sidebar is rendered TWICE (desktop rail + mobile drawer), so a
//      bare querySelector could match the hidden copy. We resolve to the
//      first target that is actually visible.
//   3. The card was clamped with a hardcoded height guess, so the last
//      step (account chip, at the very bottom) overflowed the viewport and
//      its Next button could not be clicked. The card is measured now.
//   4. Steps were a short hand-written list, so five nav sections had no
//      card at all. Every nav item now gets one, and steps whose target
//      isn't on screen (other roles, narrower nav) are dropped instead of
//      pointing at nothing.
//
// On narrow screens the sidebar is an off-canvas drawer, so there's
// nothing to spotlight — we fall back to a centered card with the same copy.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, CalendarDays, UserCircle2, BookOpen, GraduationCap,
  Megaphone, ListChecks, NotebookPen, Presentation, Blocks,
  ChevronRight, X,
} from "lucide-react";
import { useT, useI18n } from "../../lib/i18n";
import { getAccount } from "../../lib/account";

// ── Seen-state ─────────────────────────────────────────────────────────
// The tour is shown ONCE, to a genuinely new teacher. Finishing it or skipping
// it both end it for good.
//
// Two gates, because "don't show it again" means two different things:
//
//   viewCount  (localStorage, per account) — durable. Once it reaches
//              MAX_VIEWS the tour never opens again on this browser.
//   thisSession (sessionStorage) — already shown during this sign-in, so
//              navigating away from the Planner and back does not replay it.
//              Clears itself when the tab closes.
//
// Keyed per account: school devices are shared, and one teacher finishing the
// tour must not silence it for the next person who signs in.
//
// ── The bug this replaces ────────────────────────────────────────────────
// accountKey() used to fall back to the literal string "anon" when the account
// had not hydrated yet. Planner evaluates the gate at mount, and on a fresh
// sign-in the profile arrives a moment later (App.jsx fetches /api/me
// asynchronously). So the CHECK ran against bucket "anon" while the MARK — which
// happens when the teacher clicks Skip or Done, seconds later — ran against
// their real staff id. "anon" was never incremented, so the count never rose and
// the tour reappeared on every single sign-in, indefinitely. The stored value
// {"t-test-01": 2} was the fingerprint: incremented twice, never once consulted.
//
// The fix is to have no fallback bucket at all. If we do not yet know who this
// is, we do not decide — the caller waits for the account and asks again.
const VIEWS_KEY = "murchid.tour.planner.views";
const SESSION_KEY = "murchid.tour.planner.session";
const MAX_VIEWS = 1;

// staffId is the stable per-teacher handle, with email as the fallback for an
// account cached before the profile step wrote one. Both already live in the
// same localStorage record, so keying on them exposes nothing new.
//
// Returns null — never a placeholder — when neither is available yet.
const accountKey = () => {
  try {
    const p = getAccount()?.profile;
    const k = p?.staffId || p?.email;
    return k ? String(k).toLowerCase() : null;
  } catch {
    return null;
  }
};

/** Do we know who this teacher is yet? The caller must wait until we do. */
export const tourIdentityReady = () => accountKey() !== null;

const readViews = () => {
  try {
    return JSON.parse(localStorage.getItem(VIEWS_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

/** Has this account used up its allowance, or already seen it this session? */
export const shouldShowPlannerTour = () => {
  const key = accountKey();
  // No identity yet: refuse to decide rather than guessing. Deciding here is
  // what produced the bug above.
  if (!key) return false;
  try {
    if (sessionStorage.getItem(`${SESSION_KEY}.${key}`) === "1") return false;
  } catch {
    /* private mode — fall through to the durable count */
  }
  return (readViews()[key] || 0) < MAX_VIEWS;
};

/** Record that the tour is done — finished or skipped, both end it. */
export const markPlannerTourSeen = () => {
  const key = accountKey();
  if (!key) return;
  try {
    const all = readViews();
    all[key] = Math.min((all[key] || 0) + 1, MAX_VIEWS);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(`${SESSION_KEY}.${key}`, "1");
  } catch {
    /* ignore */
  }
};

// ── Steps ──────────────────────────────────────────────────────────────
// One per sidebar destination, in rail order: nav items top-to-bottom,
// then the Studio launcher, then the account chip. `id` selects the copy
// keys (tour.<id>.title / .body); `target` is the data-tour attribute on
// the real element.
const STEPS = [
  { id: "planner",       target: "nav-planner",       icon: CalendarDays },
  { id: "bulletin",      target: "nav-bulletin-board", icon: Megaphone },
  { id: "lesson",        target: "nav-lesson-plans",  icon: BookOpen },
  { id: "quizzes",       target: "nav-quizzes",       icon: ListChecks },
  { id: "homework",      target: "nav-homework",      icon: NotebookPen },
  { id: "presentations", target: "nav-presentations", icon: Presentation },
  { id: "activities",    target: "nav-activities",    icon: Blocks },
  { id: "students",      target: "nav-database",      icon: GraduationCap },
  { id: "studio",        target: "studio",            icon: Sparkles },
  { id: "menu",          target: "account",           icon: UserCircle2 },
];

const PAD = 6;          // breathing room around the spotlit element
const CARD_W = 340;     // explainer card width
const GAP = 16;         // gap between element and card
const MARGIN = 12;      // min distance from any viewport edge

// The sidebar renders twice (desktop rail + mobile drawer). Pick the copy
// that is actually laid out and on screen; if neither is, return null so
// the caller falls back to the centered card.
function resolveTarget(target) {
  const nodes = document.querySelectorAll(`[data-tour="${target}"]`);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= 0 || r.left >= window.innerWidth) continue;
    return el;
  }
  return null;
}

export default function PlannerTour({ open, onClose }) {
  const t = useT();
  const { dir } = useI18n();
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardH, setCardH] = useState(0);
  const cardRef = useRef(null);

  // Only steps whose target exists for this role/layout. Computed once per
  // opening — the rail doesn't change shape mid-tour, so re-deriving on
  // every render would be wasted work.
  const steps = useMemo(() => {
    if (!open) return STEPS;
    const live = STEPS.filter((s) => resolveTarget(s.target));
    return live.length ? live : STEPS;
  }, [open]);

  const total = steps.length;
  const step = steps[Math.min(idx, total - 1)];
  const last = idx >= total - 1;

  const finish = useCallback(() => {
    markPlannerTourSeen();
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (open) setIdx(0);
  }, [open]);

  // Bring the target into view inside its own scroll container, then
  // measure it. Without the scroll the nav items below the fold report a
  // clipped box and the spotlight lands on the wrong element.
  useLayoutEffect(() => {
    if (!open || !step) return undefined;
    let raf = 0;

    const measure = () => {
      const el = resolveTarget(step.target);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };

    const el = resolveTarget(step.target);
    if (el) {
      // "nearest" scrolls only if it actually needs to, so steps already
      // visible don't jump. Instant: we measure on the next frame.
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
    raf = requestAnimationFrame(measure);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, idx, step]);

  // Measure the card so the vertical clamp uses its real height. The old
  // hardcoded 240px let the final card run off the bottom of the screen
  // with its Next button unreachable.
  useLayoutEffect(() => {
    if (!open || !rect) return;
    const h = cardRef.current?.offsetHeight || 0;
    if (h && h !== cardH) setCardH(h);
  }, [open, rect, idx, cardH]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") finish();
      else if (e.key === "Enter" || e.key === "ArrowRight") (last ? finish() : setIdx((i) => i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, last, finish]);

  if (!open || !step) return null;
  const Icon = step.icon;

  // Float beside the spotlit element: trailing side when there's room,
  // otherwise leading side. Vertical position is clamped against the
  // measured card height so the footer buttons are always reachable.
  let cardStyle;
  if (rect) {
    let left = rect.left + rect.width + GAP;
    if (left + CARD_W > window.innerWidth - MARGIN) {
      left = rect.left - CARD_W - GAP;
    }
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - CARD_W - MARGIN));

    const h = cardH || 260;
    let top = rect.top - 8;
    top = Math.min(top, window.innerHeight - h - MARGIN);
    top = Math.max(MARGIN, top);
    cardStyle = { position: "fixed", left, top, width: CARD_W };
  }

  const Card = (
    <div
      ref={cardRef}
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
          {t("tour.stepOf", {
            n: String(idx + 1).padStart(2, "0"),
            total: String(total).padStart(2, "0"),
          })}
        </p>
        <h3 className="font-serif text-xl font-medium text-ink leading-tight mb-2">
          {t(`tour.${step.id}.title`)}
        </h3>
        <p className="text-sm text-ink-soft leading-relaxed">
          {t(`tour.${step.id}.body`)}
        </p>
      </div>

      <div className="px-6 py-3.5 border-t border-line bg-paper flex items-center justify-between gap-2">
        {/* Dots stay a fixed size regardless of step count so ten steps
            don't push the buttons out of the card. */}
        <div className="flex items-center gap-1 min-w-0 flex-shrink">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all flex-shrink-0 ${
                i === idx ? "w-4 bg-accent" : "w-1.5 bg-line"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
          {/* Click-catcher: the dimming is done by the highlight's giant
              box-shadow, so this layer is transparent and only swallows
              clicks outside the spotlight. */}
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
