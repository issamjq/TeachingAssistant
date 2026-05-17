import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

// Lightweight in-house i18n — no dependency. EN + AR with full RTL.
// t("some.key", { name }) → string; falls back to EN then the key.
// Translation is rolled out surface by surface; anything not yet keyed
// just shows its English literal.

const STORAGE_KEY = "mudir.lang";
const RTL_LANGS = new Set(["ar"]);

// ── Dictionaries ──────────────────────────────────────────────────
const EN = {
  // global nav / sidebar
  "nav.planning": "Planning",
  "nav.teaching": "Teaching",
  "nav.data": "Data",
  "nav.admin": "Admin",
  "nav.dev": "Dev",
  "nav.planner": "Planner",
  "nav.lesson-plans": "Lesson Plans",
  "nav.quizzes": "Quizzes",
  "nav.homework": "Homework",
  "nav.presentations": "Presentations",
  "nav.activities": "Activities",
  "nav.database": "My students",
  "nav.admin-console": "Admin console",
  "nav.dev-console": "Dev console",
  "nav.account": "Account",
  "nav.studio": "Studio",
  "nav.reports": "Reports",
  // studio launcher card
  "studio.name": "Studio",
  "studio.subtitle": "Your AI co-pilot for teaching",
  "studio.tagline": "Create · Plan · Inspire",
  "studio.open": "Open Studio",
  "studio.badge": "AI",
  // account footer
  "account.teacher": "Teacher",
  "account.admin": "Admin",
  "account.dev": "Dev",
  // common
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.new": "New",
  "common.close": "Close",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.loading": "Loading…",
  "common.language": "Language",
  // landing — top nav
  "landing.nav.problem": "Problem",
  "landing.nav.solution": "Solution",
  "landing.nav.tools": "Tools",
  "landing.nav.dashboard": "Dashboard",
  "landing.nav.studio": "Studio",
  "landing.nav.try": "Try it",
  "landing.nav.openPlanner": "Lesson Planner →",
  // landing — hero
  "landing.hero.eyebrow": "For teachers, KG–G12 / UAE & beyond",
  "landing.hero.title": "Lesson prep in thirty seconds.",
  "landing.hero.sub":
    "Teachers spend 10+ hours a week preparing lessons after school. Mudir is the AI lesson director that turns a topic into a complete teaching package — plan, slides, worksheet, quiz, homework — aligned to your curriculum. KG through Grade 12. English and Arabic.",
  "landing.hero.ctaPrimary": "Try the prototype →",
  "landing.hero.ctaGhost": "See how it works",
};

const AR = {
  "nav.planning": "التخطيط",
  "nav.teaching": "التدريس",
  "nav.data": "البيانات",
  "nav.admin": "الإدارة",
  "nav.dev": "المطوّر",
  "nav.planner": "المخطّط",
  "nav.lesson-plans": "خطط الدروس",
  "nav.quizzes": "الاختبارات",
  "nav.homework": "الواجبات",
  "nav.presentations": "العروض التقديمية",
  "nav.activities": "الأنشطة",
  "nav.database": "طلابي",
  "nav.admin-console": "لوحة الإدارة",
  "nav.dev-console": "لوحة المطوّر",
  "nav.account": "الحساب",
  "nav.studio": "الاستوديو",
  "nav.reports": "التقارير",
  "studio.name": "الاستوديو",
  "studio.subtitle": "مساعدك الذكي في التدريس",
  "studio.tagline": "أنشئ · خطّط · ألهم",
  "studio.open": "افتح الاستوديو",
  "studio.badge": "ذكاء",
  "account.teacher": "معلّم",
  "account.admin": "مدير",
  "account.dev": "مطوّر",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.new": "جديد",
  "common.close": "إغلاق",
  "common.edit": "تعديل",
  "common.delete": "حذف",
  "common.loading": "جارٍ التحميل…",
  "common.language": "اللغة",
  "landing.nav.problem": "المشكلة",
  "landing.nav.solution": "الحل",
  "landing.nav.tools": "الأدوات",
  "landing.nav.dashboard": "لوحة التحكم",
  "landing.nav.studio": "الاستوديو",
  "landing.nav.try": "جرّبه",
  "landing.nav.openPlanner": "مخطّط الدروس ←",
  "landing.hero.eyebrow": "للمعلّمين، من الروضة إلى الصف 12 / الإمارات وما بعدها",
  "landing.hero.title": "تحضير الدرس في ثلاثين ثانية.",
  "landing.hero.sub":
    "يقضي المعلّمون أكثر من 10 ساعات أسبوعيًا في تحضير الدروس بعد المدرسة. مدير هو مدير الدروس الذكي الذي يحوّل أي موضوع إلى حزمة تدريس متكاملة — خطة وشرائح وورقة عمل واختبار وواجب — متوافقة مع منهجك. من الروضة إلى الصف 12. بالعربية والإنجليزية.",
  "landing.hero.ctaPrimary": "جرّب النموذج ←",
  "landing.hero.ctaGhost": "شاهد كيف يعمل",
};

const DICTS = { en: EN, ar: AR };

// ── Context ───────────────────────────────────────────────────────
const I18nContext = createContext({
  lang: "en",
  dir: "ltr",
  isRTL: false,
  setLang: () => {},
  t: (k) => k,
});

function applyDocumentLang(lang) {
  if (typeof document === "undefined") return;
  const dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof localStorage === "undefined") return "en";
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "ar" || saved === "en" ? saved : "en";
  });

  useEffect(() => { applyDocumentLang(lang); }, [lang]);

  const setLang = useCallback((next) => {
    const v = next === "ar" ? "ar" : "en";
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
    setLangState(v);
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = DICTS[lang] || EN;
      let s = dict[key];
      if (s == null) s = EN[key];
      if (s == null) return key;
      if (vars) {
        for (const [k, val] of Object.entries(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(val));
        }
      }
      return s;
    },
    [lang]
  );

  const dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  const value = { lang, dir, isRTL: dir === "rtl", setLang, t };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
// Convenience: const t = useT();
export function useT() {
  return useContext(I18nContext).t;
}

// ── Language toggle ───────────────────────────────────────────────
// Compact EN | ع pill. Drop it anywhere (sidebar, landing nav).
export function LangToggle({ className = "" }) {
  const { lang, setLang } = useI18n();
  const opts = [
    { v: "en", label: "EN" },
    { v: "ar", label: "ع" },
  ];
  return (
    <div
      className={`inline-flex items-center rounded-full border border-line bg-paper-cool p-0.5 ${className}`}
      role="group"
      aria-label="Language"
      dir="ltr"
    >
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => setLang(o.v)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium leading-none transition ${
            lang === o.v
              ? "bg-ink text-paper-cool"
              : "text-ink-soft hover:text-ink"
          }`}
          aria-pressed={lang === o.v}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
