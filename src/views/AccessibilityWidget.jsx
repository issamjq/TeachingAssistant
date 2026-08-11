"use client";

// Renders into a portal, reads localStorage, and uses layout effects —
// unambiguously a client component. The directive was unnecessary while
// everything mounted below legacy/LegacyRoot (already "use client"); it is
// required now that peeled server-component layouts import it directly.
import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Accessibility, X, Type, Eye, Volume2, RotateCcw,
  MousePointer2, Link2, Pause, Contrast, Droplet, Minus, Plus,
} from "lucide-react";
import { useI18n } from "../lib/i18n";

// Native accessibility toolbar. Floating launcher + panel, portaled to
// document.body so it sits OUTSIDE #root and stays unaffected by the
// visual filters (zoom / grayscale / contrast) we apply to #root.
// Preferences persist per-device in localStorage.

const STORAGE_KEY = "murchid.a11y";
const THEME_KEY = "murchid.theme";

/** "light" | "system" | "dark". Nothing stored means light: that is the
 * product default, whatever the device prefers. */
function readTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "system" ? t : "light";
  } catch {
    return "light";
  }
}

function writeTheme(next) {
  const el = document.documentElement;
  const deviceDark =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  // The only attribute that exists is data-theme="dark"; the base tokens
  // are light, so "light" and "auto on a light device" both mean no
  // attribute at all.
  if (next === "dark" || (next === "system" && deviceDark)) el.dataset.theme = "dark";
  else delete el.dataset.theme;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* a locked-down browser still gets the change, just not the memory */
  }
}

const DEFAULTS = {
  textStep: 0,        // 0..4  → zoom 1, 1.1, 1.2, 1.35, 1.5
  readableFont: false,
  letterStep: 0,      // 0..3
  wordStep: 0,        // 0..3
  lineStep: 0,        // 0..3
  contrast: false,
  grayscale: false,
  lowSat: false,
  colorBlind: "off",   // off | prot | deut | trit
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

  // Combine every colour transform into ONE inline filter so a
  // colour-blind SVG filter can stack with contrast/grayscale instead
  // of competing class rules clobbering each other.
  const f = [];
  if (s.colorBlind && s.colorBlind !== "off") f.push(`url(#a11y-cb-${s.colorBlind})`);
  if (s.grayscale) f.push("grayscale(1)");
  else if (s.lowSat) f.push("saturate(0.45)");
  if (s.contrast) f.push("contrast(1.32)");
  st.filter = f.join(" ");

  const cl = root.classList;
  cl.toggle("a11y-zoom-on", s.textStep > 0);
  cl.toggle("a11y-readable", s.readableFont);
  cl.toggle("a11y-spaced", s.letterStep > 0 || s.wordStep > 0 || s.lineStep > 0);
  cl.toggle("a11y-contrast", s.contrast);
  cl.toggle("a11y-big-cursor", s.bigCursor);
  cl.toggle("a11y-hl-links", s.highlightLinks);
  cl.toggle("a11y-stop-anim", s.stopAnim);
  cl.toggle("a11y-read-aloud", s.readAloud);
}

const isDefault = (s) =>
  Object.keys(DEFAULTS).every((k) => s[k] === DEFAULTS[k]);

export default function AccessibilityWidget({ embedded = false, bottomOffset = 0 } = {}) {
  // bottomOffset lifts the launcher clear of anything else anchored to the
  // same corner. On the marketing page the assistant sits at the bottom
  // right; without this the two launchers land exactly on top of each other.
  const { t, dir, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(loadSettings);
  // Rendered as "system" on the server and corrected on mount, so the
  // markup cannot disagree with what the pre-paint script already did.
  const [theme, setTheme] = useState("light");
  useEffect(() => { setTheme(readTheme()); }, []);
  const panelRef = useRef(null);

  // Portal into one stable, reused container instead of loose into
  // <body>. Portaling straight into document.body lets a hot-reload (dev)
  // or a dir flip orphan the old launcher node; two stacked drop-shadows
  // then read as a dark halo behind the button until the page is
  // refreshed. Reusing #a11y-root — and clearing any leftover children on
  // (re)mount — keeps exactly one launcher in the DOM.
  // Created in an effect, not during render. createPortal cannot be
  // server-rendered, so building the container during render made the server
  // and client trees disagree — React reported a hydration mismatch and threw
  // the whole subtree away, which is why the launcher vanished entirely on
  // server-rendered routes. Deferring to an effect means SSR emits nothing
  // here and the portal appears on mount.
  const [portalRoot, setPortalRoot] = useState(null);
  useEffect(() => {
    let node = document.getElementById("a11y-root");
    if (node) {
      node.replaceChildren(); // drop orphans from a previous (hot-reloaded) tree
    } else {
      node = document.createElement("div");
      node.id = "a11y-root";
      document.body.appendChild(node);
    }
    setPortalRoot(node);
  }, []);

  // Persist + apply on every change.
  // The assistant can change these too ("make the text bigger"), and it
  // writes the same key rather than reaching into this component. Both a
  // real cross-tab storage event and the synthetic one it dispatches
  // land here, so the panel and the page update together.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key && e.key !== STORAGE_KEY) return;
      setS(loadSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  // Defensive cleanup: when direction flips, sweep document.body for
  // any stale launcher/panel nodes left over from the previous direction
  // (React's portal + key={dir} should handle this, but a stale DOM node
  // has been observed surviving a lang flip until a page refresh — this
  // guarantees only the current direction's element remains).
  useLayoutEffect(() => {
    const stale = document.querySelectorAll(
      `[data-a11y-node]:not([data-a11y-dir="${dir}"])`
    );
    stale.forEach((el) => el.remove());
  }, [dir, open]);

  const set = useCallback((patch) => setS((p) => ({ ...p, ...patch })), []);
  const reset = useCallback(() => {
    window.speechSynthesis?.cancel();
    setS({ ...DEFAULTS });
  }, []);

  const stopReading = () => window.speechSynthesis?.cancel();
  // Anchored to the trailing-bottom corner (right in LTR, left in RTL)
  // to stay clear of the sidebar account/profile button.
  // Both sides are always set (opposite = "auto") so a language flip
  // can't leave a stale `right`/`left` on the DOM node — without this
  // the widget visually pins to BOTH edges until the page is refreshed.
  const side = dir === "rtl"
    ? { right: "auto", left: 20 }
    : { left: "auto", right: 20 };
  const dirty = !isDefault(s);

  // Pill that appears next to the launcher whenever any filter / setting is
  // off-default. It surfaces the state (so the teacher knows the page is
  // being transformed by the widget — not a bug) and offers a single tap
  // to clear everything without opening the panel. The pill sits 64px to
  // the inside of the launcher so it doesn't cover the button itself.
  const resetChip = dirty && (
    <button
      key={`reset-chip-${dir}`}
      type="button"
      data-a11y-node="reset-chip"
      data-a11y-dir={dir}
      onClick={reset}
      aria-label={t("a11y.reset")}
      title={t("a11y.reset")}
      style={{
        position: "fixed",
        bottom: 26 + bottomOffset,
        ...(dir === "rtl"
          ? { right: "auto", left: 84 }
          : { left: "auto", right: 84 }),
        zIndex: 2147483000,
      }}
      className="group inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-invert text-on-invert text-[12px] font-medium tracking-wide shadow-[0_6px_18px_rgba(26,24,20,0.32)] ring-1 ring-white/15 hover:bg-[color:color-mix(in_oklab,var(--p-accent)_25%,var(--p-invert))] transition"
    >
      <span className="relative grid place-items-center w-2 h-2">
        <span className="absolute inset-0 rounded-full bg-[color:var(--p-accent)] animate-ping opacity-75" />
        <span className="relative w-2 h-2 rounded-full bg-[color:var(--p-accent)]" />
      </span>
      <span>{t("a11y.filtersOn")}</span>
      <span className="opacity-60 group-hover:opacity-100">·</span>
      <span className="underline-offset-2 group-hover:underline">
        {t("a11y.resetShort")}
      </span>
    </button>
  );

  const launcher = (
    <button
      key={dir}
      type="button"
      data-a11y-node="launcher"
      data-a11y-dir={dir}
      onClick={() => setOpen((o) => !o)}
      aria-label={t("a11y.open")}
      title={t("a11y.open")}
      style={{ position: "fixed", bottom: 20 + bottomOffset, ...side, zIndex: 2147483000 }}
      className="grid place-items-center w-14 h-14 rounded-full bg-[color:var(--p-paper-cool)] text-[color:var(--p-accent)] shadow-[0_8px_24px_rgba(26,24,20,0.32)] ring-2 ring-[color:var(--p-accent)]/25 transition hover:scale-105 active:scale-95"
    >
      <Accessibility size={28} strokeWidth={2.2} />
      {dirty && (
        <>
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[color:var(--p-accent)] ring-2 ring-white animate-ping opacity-70"
            aria-hidden="true"
          />
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[color:var(--p-ok)] ring-2 ring-white"
            aria-hidden="true"
          />
        </>
      )}
    </button>
  );

  // The settings themselves, lifted out of the panel so the assistant
  // can render them as one of its tabs. The launcher, the scrim and the
  // dialog chrome stay below — an embedded copy has no business drawing
  // a floating button of its own.
  const settingsBody = (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {/* Quick profiles */}
        <div>
          <p className="px-1 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[color:var(--p-muted)]">
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
        <Choice
          icon={<Eye size={17} />}
          label={t("a11y.colorBlind")}
          hint={t("a11y.colorBlindHint")}
          value={s.colorBlind}
          options={[
            { v: "off", label: t("a11y.cb.off") },
            { v: "prot", label: t("a11y.cb.prot") },
            { v: "deut", label: t("a11y.cb.deut") },
            { v: "trit", label: t("a11y.cb.trit") },
          ]}
          onChange={(v) => set({ colorBlind: v })}
        />

        <Choice
          icon={<Contrast size={17} />}
          label={t("a11y.theme")}
          hint={t("a11y.themeHint")}
          value={theme}
          cols={3}
          options={[
            { v: "light", label: t("a11y.theme.light") },
            { v: "system", label: t("a11y.theme.system") },
            { v: "dark", label: t("a11y.theme.dark") },
          ]}
          onChange={(v) => { setTheme(v); writeTheme(v); }}
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
            className="w-full text-[12px] font-medium py-1.5 rounded-lg border border-[color:var(--p-line)] text-[color:var(--p-muted)] hover:bg-[color:var(--p-paper-warm)] transition"
          >
            {t("a11y.stopReading")}
          </button>
        )}
      </div>

      <footer className="px-4 py-3 border-t border-[color:var(--p-line)] bg-[color:var(--p-paper)] flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={!dirty}
          className="flex-1 inline-flex items-center justify-center gap-1.5 text-[12.5px] font-medium py-2 rounded-lg border border-[color:var(--p-line)] text-[color:var(--p-ink-soft)] hover:bg-[color:var(--p-paper-warm)] transition disabled:opacity-40 disabled:cursor-default"
        >
          <RotateCcw size={14} />
          {t("a11y.reset")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 text-[12.5px] font-semibold py-2 rounded-lg bg-invert text-on-invert hover:bg-[color:color-mix(in_oklab,var(--p-accent)_25%,var(--p-invert))] transition"
        >
          {t("a11y.done")}
        </button>
      </footer>
    </>
  );

  const panel = open && (
    <>
      <div
        data-a11y-node="scrim"
        data-a11y-dir={dir}
        onClick={() => setOpen(false)}
        style={{ position: "fixed", inset: 0, zIndex: 2147483000 }}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={t("a11y.title")}
        dir={dir}
        data-a11y-node="panel"
        data-a11y-dir={dir}
        style={{
          position: "fixed",
          bottom: 88 + bottomOffset,
          ...side,
          zIndex: 2147483001,
          width: 340,
          maxHeight: "min(78vh, 640px)",
        }}
        className="flex flex-col rounded-2xl bg-[color:var(--p-paper-cool)] text-ink border border-[color:var(--p-line)] shadow-[0_24px_60px_rgba(26,24,20,0.34)] overflow-hidden"
      >
        <header className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-[color:var(--p-line)] bg-[color:var(--p-paper)]">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-[color:var(--p-accent)] text-white shrink-0">
            <Accessibility size={20} strokeWidth={2.2} />
          </span>
          <div className="flex-1 min-w-0">
            <h2
              className="text-[17px] leading-tight font-semibold"
              style={{ fontFamily: '"Fraunces", Georgia, serif' }}
            >
              {t("a11y.title")}
            </h2>
            <p className="text-[11.5px] text-[color:var(--p-muted)] leading-snug mt-0.5">
              {t("a11y.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("a11y.done")}
            className="grid place-items-center w-7 h-7 rounded-full text-[color:var(--p-muted)] hover:bg-[color:var(--p-paper-warm)] transition"
          >
            <X size={17} />
          </button>
        </header>

      {settingsBody}
      </div>
    </>
  );

  // Embedded: the assistant panel owns the chrome, so hand back only the
  // controls. No portal either — this one belongs inside the caller's
  // layout, not pinned to the body.
  if (embedded) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <ColorBlindDefs />
        {settingsBody}
      </div>
    );
  }

  // Nothing to render until the effect above has attached the container
  // (i.e. during SSR and the first client render).
  if (!portalRoot) return null;

  return createPortal(
    <>
      <ColorBlindDefs />
      {resetChip}
      {launcher}
      {panel}
    </>,
    portalRoot
  );
}

// Daltonization-style colour-matrix filters referenced from #root via
// filter:url(#a11y-cb-*). Kept in the body-level portal but usable
// document-wide; hidden so it never affects layout.
function ColorBlindDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="a11y-cb-prot">
          <feColorMatrix
            type="matrix"
            values="0.567 0.433 0 0 0
                    0.558 0.442 0 0 0
                    0     0.242 0.758 0 0
                    0     0     0 1 0"
          />
        </filter>
        <filter id="a11y-cb-deut">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0 0 0
                    0.7   0.3   0 0 0
                    0     0.3   0.7 0 0
                    0     0     0 1 0"
          />
        </filter>
        <filter id="a11y-cb-trit">
          <feColorMatrix
            type="matrix"
            values="0.95 0.05  0     0 0
                    0    0.433 0.567 0 0
                    0    0.475 0.525 0 0
                    0    0     0     1 0"
          />
        </filter>
      </defs>
    </svg>
  );
}

function ProfileBtn({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-medium leading-tight px-1.5 py-2 rounded-lg border border-[color:var(--p-line)] bg-[color:var(--p-paper)] text-[color:var(--p-ink-soft)] hover:border-[color:var(--p-accent)] hover:text-[color:var(--p-accent)] transition"
    >
      {label}
    </button>
  );
}

function Row({ icon, label, hint, children }) {
  return (
    <div className="flex items-center gap-3 px-2.5 py-2 rounded-xl border border-[color:var(--p-line-soft)] bg-[color:var(--p-paper)]">
      <span className="grid place-items-center w-7 h-7 rounded-lg bg-[color:var(--p-paper-warm)] text-[color:var(--p-ink-soft)] shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium leading-tight">{label}</p>
        {hint && (
          <p className="text-[11px] text-[color:var(--p-muted)] leading-snug mt-0.5">{hint}</p>
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
          on ? "bg-ok" : "bg-line"
        }`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-paper-cool shadow transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
        <span className="sr-only">{on ? tOn : tOff}</span>
      </button>
    </Row>
  );
}

function Choice({ icon, label, hint, value, options, onChange, cols = 4 }) {
  return (
    <div className="px-2.5 py-2 rounded-xl border border-[color:var(--p-line-soft)] bg-[color:var(--p-paper)]">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-7 h-7 rounded-lg bg-[color:var(--p-paper-warm)] text-[color:var(--p-ink-soft)] shrink-0">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium leading-tight">{label}</p>
          {hint && (
            <p className="text-[11px] text-[color:var(--p-muted)] leading-snug mt-0.5">{hint}</p>
          )}
        </div>
      </div>
      <div
        className="mt-2 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            aria-pressed={value === o.v}
            className={`text-[11px] font-medium py-1.5 rounded-lg border transition ${
              value === o.v
                ? "bg-invert text-on-invert border-invert"
                : "bg-[color:var(--p-paper-cool)] text-[color:var(--p-ink-soft)] border-[color:var(--p-line)] hover:border-[color:var(--p-accent)] hover:text-[color:var(--p-accent)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
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
          className="grid place-items-center w-7 h-7 rounded-lg border border-[color:var(--p-line)] text-[color:var(--p-ink-soft)] hover:bg-[color:var(--p-paper-warm)] transition disabled:opacity-35"
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
          className="grid place-items-center w-7 h-7 rounded-lg border border-[color:var(--p-line)] text-[color:var(--p-ink-soft)] hover:bg-[color:var(--p-paper-warm)] transition disabled:opacity-35"
        >
          <Plus size={14} />
        </button>
      </div>
    </Row>
  );
}
