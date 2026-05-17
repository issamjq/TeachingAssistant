import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Accessibility, X, Type, Eye, Volume2, RotateCcw,
  MousePointer2, Link2, Pause, Contrast, Droplet, Minus, Plus,
} from "lucide-react";
import { useI18n } from "../lib/i18n.jsx";

// Native accessibility toolbar. Floating launcher + panel, portaled to
// document.body so it sits OUTSIDE #root and stays unaffected by the
// visual filters (zoom / grayscale / contrast) we apply to #root.
// Preferences persist per-device in localStorage.

const STORAGE_KEY = "mudir.a11y";

const DEFAULTS = {
  textStep: 0,        // 0..4  → zoom 1, 1.1, 1.2, 1.35, 1.5
  readableFont: false,
  letterStep: 0,      // 0..3
  wordStep: 0,        // 0..3
  lineStep: 0,        // 0..3
  contrast: false,
  grayscale: false,
  lowSat: false,
  bigCursor: false,
  highlightLinks: false,
  stopAnim: false,
  readAloud: false,
};

const ZOOMS = [1, 1.1, 1.2, 1.35, 1.5];
const LETTER = [0, 0.06, 0.12, 0.2];      // em
const WORD = [0, 0.1, 0.22, 0.4];         // em
const LINE = [1.5, 1.7, 2, 2.4];          // unitless (applied when step>0)

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function applyToRoot(s) {
  const root = document.getElementById("root");
  if (!root) return;
  const st = root.style;
  st.setProperty("--a11y-zoom", String(ZOOMS[s.textStep] || 1));
  st.setProperty("--a11y-letter", `${LETTER[s.letterStep] || 0}em`);
  st.setProperty("--a11y-word", `${WORD[s.wordStep] || 0}em`);
  st.setProperty("--a11y-line", String(LINE[s.lineStep] || 1.5));

  const cl = root.classList;
  cl.toggle("a11y-zoom-on", s.textStep > 0);
  cl.toggle("a11y-readable", s.readableFont);
  cl.toggle("a11y-spaced", s.letterStep > 0 || s.wordStep > 0 || s.lineStep > 0);
  cl.toggle("a11y-contrast", s.contrast);
  cl.toggle("a11y-grayscale", s.grayscale);
  cl.toggle("a11y-low-sat", s.lowSat && !s.grayscale);
  cl.toggle("a11y-big-cursor", s.bigCursor);
  cl.toggle("a11y-hl-links", s.highlightLinks);
  cl.toggle("a11y-stop-anim", s.stopAnim);
  cl.toggle("a11y-read-aloud", s.readAloud);
}

const isDefault = (s) =>
  Object.keys(DEFAULTS).every((k) => s[k] === DEFAULTS[k]);

export default function AccessibilityWidget() {
  const { t, dir, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(loadSettings);
  const panelRef = useRef(null);

  // Persist + apply on every change.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
    applyToRoot(s);
  }, [s]);

  // Read-aloud: while enabled, clicking any text inside #root speaks it.
  useEffect(() => {
    if (!s.readAloud) {
      window.speechSynthesis?.cancel();
      return;
    }
    const root = document.getElementById("root");
    if (!root || !window.speechSynthesis) return;
    const onClick = (e) => {
      const txt = (e.target?.innerText || e.target?.textContent || "").trim();
      if (!txt) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt.slice(0, 600));
      u.lang = lang === "ar" ? "ar-SA" : "en-US";
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    };
    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, [s.readAloud, lang]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const set = useCallback((patch) => setS((p) => ({ ...p, ...patch })), []);
  const reset = useCallback(() => {
    window.speechSynthesis?.cancel();
    setS({ ...DEFAULTS });
  }, []);

  const stopReading = () => window.speechSynthesis?.cancel();
  const side = dir === "rtl" ? { right: 20 } : { left: 20 };
  const dirty = !isDefault(s);

  const launcher = (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-label={t("a11y.open")}
      title={t("a11y.open")}
      style={{ position: "fixed", bottom: 20, ...side, zIndex: 2147483000 }}
      className="grid place-items-center w-14 h-14 rounded-full bg-[#c8472b] text-white shadow-[0_8px_24px_rgba(26,24,20,0.32)] ring-2 ring-white/70 transition hover:scale-105 active:scale-95"
    >
      <Accessibility size={28} strokeWidth={2.2} />
      {dirty && (
        <span
          className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#6b7f5a] ring-2 ring-white"
          aria-hidden="true"
        />
      )}
    </button>
  );

  const panel = open && (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 2147483000 }}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t("a11y.title")}
        dir={dir}
        style={{
          position: "fixed",
          bottom: 88,
          ...side,
          zIndex: 2147483001,
          width: 340,
          maxHeight: "min(78vh, 640px)",
        }}
        className="flex flex-col rounded-2xl bg-[#faf6ec] text-[#1a1814] border border-[#d4c9b3] shadow-[0_24px_60px_rgba(26,24,20,0.34)] overflow-hidden"
      >
        <header className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-[#d4c9b3] bg-[#f4ede0]">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-[#c8472b] text-white shrink-0">
            <Accessibility size={20} strokeWidth={2.2} />
          </span>
          <div className="flex-1 min-w-0">
            <h2
              className="text-[17px] leading-tight font-semibold"
              style={{ fontFamily: '"Fraunces", Georgia, serif' }}
            >
              {t("a11y.title")}
            </h2>
            <p className="text-[11.5px] text-[#6b6354] leading-snug mt-0.5">
              {t("a11y.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("a11y.done")}
            className="grid place-items-center w-7 h-7 rounded-full text-[#6b6354] hover:bg-[#ede4d3] transition"
          >
            <X size={17} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {/* Quick profiles */}
          <div>
            <p className="px-1 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#6b6354]">
              {t("a11y.profilesTitle")}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <ProfileBtn
                label={t("a11y.visionProfile")}
                onClick={() =>
                  set({ textStep: 3, contrast: true, bigCursor: true })
                }
              />
              <ProfileBtn
                label={t("a11y.dyslexiaProfile")}
                onClick={() =>
                  set({
                    readableFont: true,
                    letterStep: 1,
                    wordStep: 1,
                    lineStep: 2,
                  })
                }
              />
              <ProfileBtn
                label={t("a11y.motorProfile")}
                onClick={() =>
                  set({
                    bigCursor: true,
                    highlightLinks: true,
                    stopAnim: true,
                  })
                }
              />
            </div>
          </div>

          <Stepper
            icon={<Type size={17} />}
            label={t("a11y.textSize")}
            hint={t("a11y.textSizeHint")}
            value={s.textStep}
            max={4}
            onChange={(v) => set({ textStep: v })}
          />

          <Toggle
            icon={<Type size={17} />}
            label={t("a11y.readableFont")}
            hint={t("a11y.readableFontHint")}
            on={s.readableFont}
            onToggle={() => set({ readableFont: !s.readableFont })}
            tOn={t("a11y.on")}
            tOff={t("a11y.off")}
          />

          <Stepper
            icon={<span className="text-[15px] font-bold tracking-[0.2em]">A</span>}
            label={t("a11y.letterSpacing")}
            value={s.letterStep}
            max={3}
            onChange={(v) => set({ letterStep: v })}
          />
          <Stepper
            icon={<span className="text-[13px] font-bold">A·A</span>}
            label={t("a11y.wordSpacing")}
            value={s.wordStep}
            max={3}
            onChange={(v) => set({ wordStep: v })}
          />
          <Stepper
            icon={<span className="text-[13px] font-bold leading-none">≡</span>}
            label={t("a11y.lineHeight")}
            value={s.lineStep}
            max={3}
            onChange={(v) => set({ lineStep: v })}
          />

          <Toggle
            icon={<Contrast size={17} />}
            label={t("a11y.contrast")}
            hint={t("a11y.contrastHint")}
            on={s.contrast}
            onToggle={() => set({ contrast: !s.contrast })}
            tOn={t("a11y.on")}
            tOff={t("a11y.off")}
          />
          <Toggle
            icon={<Eye size={17} />}
            label={t("a11y.grayscale")}
            hint={t("a11y.grayscaleHint")}
            on={s.grayscale}
            onToggle={() => set({ grayscale: !s.grayscale })}
            tOn={t("a11y.on")}
            tOff={t("a11y.off")}
          />
          <Toggle
            icon={<Droplet size={17} />}
            label={t("a11y.lowSaturation")}
            hint={t("a11y.lowSaturationHint")}
            on={s.lowSat}
            onToggle={() => set({ lowSat: !s.lowSat })}
            tOn={t("a11y.on")}
            tOff={t("a11y.off")}
          />
          <Toggle
            icon={<MousePointer2 size={17} />}
            label={t("a11y.bigCursor")}
            on={s.bigCursor}
            onToggle={() => set({ bigCursor: !s.bigCursor })}
            tOn={t("a11y.on")}
            tOff={t("a11y.off")}
          />
          <Toggle
            icon={<Link2 size={17} />}
            label={t("a11y.highlightLinks")}
            hint={t("a11y.highlightLinksHint")}
            on={s.highlightLinks}
            onToggle={() => set({ highlightLinks: !s.highlightLinks })}
            tOn={t("a11y.on")}
            tOff={t("a11y.off")}
          />
          <Toggle
            icon={<Pause size={17} />}
            label={t("a11y.stopAnimations")}
            hint={t("a11y.stopAnimationsHint")}
            on={s.stopAnim}
            onToggle={() => set({ stopAnim: !s.stopAnim })}
            tOn={t("a11y.on")}
            tOff={t("a11y.off")}
          />
          <Toggle
            icon={<Volume2 size={17} />}
            label={t("a11y.readAloud")}
            hint={s.readAloud ? t("a11y.readAloudOn") : t("a11y.readAloudHint")}
            on={s.readAloud}
            onToggle={() => set({ readAloud: !s.readAloud })}
            tOn={t("a11y.on")}
            tOff={t("a11y.off")}
          />
          {s.readAloud && (
            <button
              type="button"
              onClick={stopReading}
              className="w-full text-[12px] font-medium py-1.5 rounded-lg border border-[#d4c9b3] text-[#6b6354] hover:bg-[#ede4d3] transition"
            >
              {t("a11y.stopReading")}
            </button>
          )}
        </div>

        <footer className="px-4 py-3 border-t border-[#d4c9b3] bg-[#f4ede0] flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={!dirty}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium py-2 rounded-lg border border-[#d4c9b3] text-[#2d2a24] hover:bg-[#ede4d3] transition disabled:opacity-40 disabled:cursor-default"
          >
            <RotateCcw size={14} />
            {t("a11y.reset")}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 text-[12.5px] font-semibold py-2 rounded-lg bg-[#1a1814] text-[#faf6ec] hover:bg-[#2d2a24] transition"
          >
            {t("a11y.done")}
          </button>
        </footer>
      </div>
    </>
  );

  return createPortal(
    <>
      {launcher}
      {panel}
    </>,
    document.body
  );
}

function ProfileBtn({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-medium leading-tight px-1.5 py-2 rounded-lg border border-[#d4c9b3] bg-[#f4ede0] text-[#2d2a24] hover:border-[#c8472b] hover:text-[#c8472b] transition"
    >
      {label}
    </button>
  );
}

function Row({ icon, label, hint, children }) {
  return (
    <div className="flex items-center gap-3 px-2.5 py-2 rounded-xl border border-[#e3dac6] bg-[#f4ede0]">
      <span className="grid place-items-center w-7 h-7 rounded-lg bg-[#ede4d3] text-[#2d2a24] shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium leading-tight">{label}</p>
        {hint && (
          <p className="text-[11px] text-[#6b6354] leading-snug mt-0.5">{hint}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({ icon, label, hint, on, onToggle, tOn, tOff }) {
  return (
    <Row icon={icon} label={label} hint={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
          on ? "bg-[#6b7f5a]" : "bg-[#d4c9b3]"
        }`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
        <span className="sr-only">{on ? tOn : tOff}</span>
      </button>
    </Row>
  );
}

function Stepper({ icon, label, hint, value, max, onChange }) {
  return (
    <Row icon={icon} label={label} hint={hint}>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          aria-label="−"
          className="grid place-items-center w-7 h-7 rounded-lg border border-[#d4c9b3] text-[#2d2a24] hover:bg-[#ede4d3] transition disabled:opacity-35"
        >
          <Minus size={14} />
        </button>
        <span className="w-5 text-center text-[13px] font-semibold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="+"
          className="grid place-items-center w-7 h-7 rounded-lg border border-[#d4c9b3] text-[#2d2a24] hover:bg-[#ede4d3] transition disabled:opacity-35"
        >
          <Plus size={14} />
        </button>
      </div>
    </Row>
  );
}
