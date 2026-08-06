// Re-export shim — MIGRATION SCAFFOLDING.
//
// The implementation moved to shared/i18n/ (provider + hooks in index.tsx,
// dictionaries in en.ts / ar.ts). This keeps the ~50 legacy views that do
// `import { useT } from "../lib/i18n"` working untouched.
//
// New code should import from "@/shared/i18n" directly. Deleted in Phase 4.
export {
  LanguageProvider,
  LangToggle,
  useI18n,
  useT,
  tIn,
  isArabicLang,
} from "@/shared/i18n";

export type {
  I18nValue,
  TFunction,
  TranslationKey,
  TranslationVars,
} from "@/shared/i18n";
