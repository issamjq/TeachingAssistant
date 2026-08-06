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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Server-render as "en" and correct on mount. Reading localStorage in the
  // initialiser would produce a hydration mismatch for Arabic users.
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = readStorage(STORAGE_KEY);
    return saved === "ar" || saved === "en" ? saved : "en";
  });

  useEffect(() => {
    applyDocumentLang(lang);
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
