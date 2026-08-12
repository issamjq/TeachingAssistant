"use client";

// Lightweight in-house i18n — no dependency. EN + AR with full RTL.
// t("some.key", { name }) → string; falls back to EN, then to the key itself.
//
// Split out of the old 2,018-line src/lib/i18n.jsx: the dictionaries now live
// in ./en.ts and ./ar.ts, leaving this file as just the provider and hooks.
//
// The win from typing it: TranslationKey is derived from the EN dictionary,
// so a mistyped key is a compile error rather than a string that silently
// renders as itself in the UI — the previous failure mode.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Lang } from "../types/domain";
import { EN } from "./en";
import { AR } from "./ar";
import { readStorage, writeStorage } from "../lib/storage";
import styles from "./LangToggle.module.css";

const STORAGE_KEY = "murchid.lang";
const RTL_LANGS = new Set<Lang>(["ar"]);

/** Every key present in the English source dictionary. */
export type TranslationKey = keyof typeof EN;

/** Interpolation values for `{placeholder}` tokens in a string. */
export type TranslationVars = Record<string, string | number>;

export type TFunction = (key: TranslationKey, vars?: TranslationVars) => string;

const DICTS = { en: EN, ar: AR } as const;

// True when a quiz's output language reads right-to-left. Among the quiz
// languages only Arabic has a full dictionary + RTL layout here; the value
// arrives either as the code "ar" or the display name "Arabic".
export const isArabicLang = (lang: string | null | undefined): boolean =>
  lang === "ar" || lang === "Arabic";

// Shared interpolation: replace every {token} with its value.
function interpolate(s: string, vars?: TranslationVars): string {
  if (!vars) return s;
  let out = s;
  for (const [k, val] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(val));
  }
  return out;
}

function lookup(
  dict: Partial<Record<TranslationKey, string>>,
  key: TranslationKey,
  vars?: TranslationVars
): string {
  const s = dict[key] ?? EN[key];
  if (s == null) return key;
  return interpolate(s, vars);
}

// Translate a key into an EXPLICIT language, independent of the UI toggle.
// Used for exports (PDF / Word) where worksheet titles must match the quiz's
// own language, not whatever the app is currently set to. Only en/ar
// dictionaries exist, so anything that isn't Arabic falls back to English.
export function tIn(
  lang: string | null | undefined,
  key: TranslationKey,
  vars?: TranslationVars
): string {
  return lookup(isArabicLang(lang) ? AR : EN, key, vars);
}

// ── Context ───────────────────────────────────────────────────────

export interface I18nValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  isRTL: boolean;
  setLang: (next: Lang) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nValue>({
  lang: "en",
  dir: "ltr",
  isRTL: false,
  setLang: () => {},
  t: (k) => k,
});

function applyDocumentLang(lang: Lang): void {
  if (typeof document === "undefined") return;
  const dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

// The Arabic faces, fetched the moment Arabic is first selected and never
// before. Amiri is 208KB — 40% of everything the app used to spend on
// fonts — and it was being downloaded on the English page to set a
// decorative watermark and one metadata line. Reem Kufi carries Arabic
// display on the marketing surface; Cairo carries Arabic UI.
//
// Injected rather than declared in the root layout because the root is a
// server component and cannot know a device preference. The link is added
// once per document; swapping back to English leaves it in place, since
// the bytes are already spent and a teacher who toggles once will toggle
// again.
const ARABIC_FONTS_ID = "murchid-arabic-fonts";
const ARABIC_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&family=Reem+Kufi:wght@400;600&display=swap";

function ensureArabicFonts(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(ARABIC_FONTS_ID)) return;
  const link = document.createElement("link");
  link.id = ARABIC_FONTS_ID;
  link.rel = "stylesheet";
  link.href = ARABIC_FONTS_HREF;
  document.head.appendChild(link);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Server-render as "en" and correct on mount. Reading localStorage in
  // the initialiser produces a hydration mismatch for Arabic users: the
  // server has no storage, renders English, and the client's first
  // render — the one React compares against that HTML — comes back
  // Arabic, so React discards the tree and rebuilds it. The comment
  // below this line used to say exactly that while the code did the
  // opposite; the read now happens where it claimed to, on mount.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = readStorage(STORAGE_KEY);
    if (saved === "ar" || saved === "en") setLangState(saved);
  }, []);

  useEffect(() => {
    applyDocumentLang(lang);
    if (RTL_LANGS.has(lang)) ensureArabicFonts();
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    const v: Lang = next === "ar" ? "ar" : "en";
    writeStorage(STORAGE_KEY, v);
    setLangState(v);
  }, []);

  const t = useCallback<TFunction>(
    (key, vars) => lookup(DICTS[lang] ?? EN, key, vars),
    [lang]
  );

  const dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  const value: I18nValue = { lang, dir, isRTL: dir === "rtl", setLang, t };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Convenience: `const t = useT();` */
export function useT(): TFunction {
  return useContext(I18nContext).t;
}

// ── Language toggle ───────────────────────────────────────────────
// Compact EN | ع pill. Drop it anywhere (sidebar, landing nav, portals).
//
// Styles are a co-located CSS Module rather than global classes in
// landing.css. They used to live there, which meant the toggle silently
// lost all styling on any surface that didn't also render the landing page.
export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const opts: { v: Lang; label: string }[] = [
    { v: "en", label: "EN" },
    { v: "ar", label: "ع" },
  ];
  return (
    <div
      className={`${styles.toggle} ${className}`}
      data-active={lang}
      role="group"
      aria-label="Language"
      dir="ltr"
    >
      {/* Sliding indicator rides under the active option. */}
      <span className={styles.indicator} aria-hidden="true" />
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => setLang(o.v)}
          className={`${styles.option}${lang === o.v ? ` ${styles.active}` : ""}`}
          aria-pressed={lang === o.v}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
