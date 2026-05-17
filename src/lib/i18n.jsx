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
  // common
  "common.deleting": "Deleting…",
  "common.cantUndo": "This action can’t be undone.",
  // shared data-view chrome
  "dv.cards": "Cards",
  "dv.list": "List",
  "dv.recentlyDeleted": "Recently deleted",
  "dv.allTime": "All time",
  "dv.thisWeek": "This week",
  "dv.thisMonth": "This month",
  "dv.customRange": "Custom range",
  "dv.from": "From",
  "dv.to": "To",
  "dv.create": "Create",
  "dv.howA": "How would you like to ",
  "dv.howB": "?",
  "dv.manually": "Manually",
  "dv.manuallyDesc": "Fill in the fields yourself. Best when you already know what you want.",
  "dv.withAI": "With Studio AI",
  "dv.withAIDesc": "Describe what you need and let Mudir draft it for you.",
  "confirm.eyebrow": "Delete",
  "trash.title": "Trash",
  "trash.note": "Items here are auto-purged after 30 days. Restore brings them back; Delete forever clears them now.",
  "trash.empty": "Nothing in the trash. Items you delete will show up here for 30 days.",
  "trash.restore": "Restore",
  "trash.deleteForever": "Delete forever",
  "trash.confirmForever": "Delete forever? This cannot be undone.",
  "dp.placeholder": "dd / mm / yyyy",
  "dp.clear": "Clear",
  "dp.today": "Today",
  // planner
  "nav.schedule": "Schedule",
  "planner.subtitle": "Lesson plans, schedule, quizzes, homework, presentations, and activities — all on one grid.",
  "planner.all": "All",
  "planner.schedule": "Schedule",
  "planner.today": "Today",
  "planner.prevMonth": "Previous month",
  "planner.nextMonth": "Next month",
  "planner.thisMonth": "This Month Overview",
  "planner.planned": "Planned",
  "planner.completed": "Completed",
  "planner.todo": "To do",
  "planner.progress": "Progress",
  "planner.upcoming": "Upcoming",
  "planner.viewAll": "View all",
  "planner.allDay": "All day",
  "planner.quickActions": "Quick Actions",
  "planner.thisDay": "This day",
  "planner.noEntries": "No entries yet on this day.",
  "planner.newEntry": "New entry",
  "planner.studioAI": "Studio AI",
  "planner.heroA": "What would you like to ",
  "planner.heroCreate": "create",
  "planner.heroB": " today?",
  "planner.heroSub": "Your AI co-pilot that helps you plan, save time, and make every class amazing.",
  "planner.qa.lesson": "New Lesson Plan",
  "planner.qa.quiz": "New Quiz",
  "planner.qa.homework": "New Homework",
  "planner.qa.presentation": "New Presentation",
  "hero.lesson.verb": "Generate",       "hero.lesson.noun": "Lesson Plan",
  "hero.quiz.verb": "Create",           "hero.quiz.noun": "Quiz",
  "hero.presentation.verb": "Build",    "hero.presentation.noun": "Presentation",
  "hero.weekly.verb": "Plan",           "hero.weekly.noun": "Weekly Schedule",
  "hero.insights.verb": "Analyze",      "hero.insights.noun": "Students",
  "hero.ask.verb": "Ask",               "hero.ask.noun": "Anything",
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
  "common.deleting": "جارٍ الحذف…",
  "common.cantUndo": "لا يمكن التراجع عن هذا الإجراء.",
  "dv.cards": "بطاقات",
  "dv.list": "قائمة",
  "dv.recentlyDeleted": "المحذوفة مؤخرًا",
  "dv.allTime": "كل الوقت",
  "dv.thisWeek": "هذا الأسبوع",
  "dv.thisMonth": "هذا الشهر",
  "dv.customRange": "نطاق مخصص",
  "dv.from": "من",
  "dv.to": "إلى",
  "dv.create": "إنشاء",
  "dv.howA": "كيف تريد ",
  "dv.howB": "؟",
  "dv.manually": "يدويًا",
  "dv.manuallyDesc": "املأ الحقول بنفسك. الأفضل عندما تعرف ما تريد بالضبط.",
  "dv.withAI": "باستخدام استوديو الذكاء",
  "dv.withAIDesc": "صِف ما تحتاجه ودَع مدير يكتبه لك.",
  "confirm.eyebrow": "حذف",
  "trash.title": "المهملات",
  "trash.note": "تُحذف العناصر هنا تلقائيًا بعد 30 يومًا. الاستعادة تعيدها، والحذف النهائي يمسحها الآن.",
  "trash.empty": "لا شيء في المهملات. تظهر العناصر المحذوفة هنا لمدة 30 يومًا.",
  "trash.restore": "استعادة",
  "trash.deleteForever": "حذف نهائي",
  "trash.confirmForever": "حذف نهائي؟ لا يمكن التراجع عن ذلك.",
  "dp.placeholder": "يوم / شهر / سنة",
  "dp.clear": "مسح",
  "dp.today": "اليوم",
  "nav.schedule": "الجدول",
  "planner.subtitle": "خطط الدروس والجدول والاختبارات والواجبات والعروض والأنشطة — كلها في شبكة واحدة.",
  "planner.all": "الكل",
  "planner.schedule": "الجدول",
  "planner.today": "اليوم",
  "planner.prevMonth": "الشهر السابق",
  "planner.nextMonth": "الشهر التالي",
  "planner.thisMonth": "ملخّص هذا الشهر",
  "planner.planned": "مخطّط",
  "planner.completed": "مكتمل",
  "planner.todo": "المتبقّي",
  "planner.progress": "التقدّم",
  "planner.upcoming": "القادم",
  "planner.viewAll": "عرض الكل",
  "planner.allDay": "طوال اليوم",
  "planner.quickActions": "إجراءات سريعة",
  "planner.thisDay": "هذا اليوم",
  "planner.noEntries": "لا توجد إدخالات في هذا اليوم بعد.",
  "planner.newEntry": "إدخال جديد",
  "planner.studioAI": "استوديو الذكاء",
  "planner.heroA": "ماذا تريد أن ",
  "planner.heroCreate": "تُنشئ",
  "planner.heroB": " اليوم؟",
  "planner.heroSub": "مساعدك الذكي الذي يساعدك على التخطيط وتوفير الوقت وجعل كل حصة رائعة.",
  "planner.qa.lesson": "خطة درس جديدة",
  "planner.qa.quiz": "اختبار جديد",
  "planner.qa.homework": "واجب جديد",
  "planner.qa.presentation": "عرض جديد",
  "hero.lesson.verb": "أنشئ",      "hero.lesson.noun": "خطة درس",
  "hero.quiz.verb": "أنشئ",        "hero.quiz.noun": "اختبار",
  "hero.presentation.verb": "ابنِ", "hero.presentation.noun": "عرض تقديمي",
  "hero.weekly.verb": "خطّط",      "hero.weekly.noun": "جدول أسبوعي",
  "hero.insights.verb": "حلّل",    "hero.insights.noun": "الطلاب",
  "hero.ask.verb": "اسأل",         "hero.ask.noun": "أي شيء",
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
