// Claude-style help popover. Opens from the account menu.
// Three rows: send us a message (mailto), search-for-help input, FAQ list.
// No AI answers — articles are static and live in HELP_ARTICLES below.
// Modeled after Claude's in-product help so the shape feels familiar.
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Send, Search, CheckCircle2, ChevronRight, ArrowLeft } from "lucide-react";
import { useT, useI18n } from "../lib/i18n";

const SUPPORT_EMAIL = "support@murchid.app";

// Each article has bilingual title + body. Title is the row label
// in the list; body is the markdown-ish content shown when the row
// opens. Keep titles short — they truncate at ~one line.
// Add more entries here as the teacher FAQ grows.
const HELP_ARTICLES = [
  {
    id: "getting-started",
    title: { en: "Getting started with Murchid", ar: "البدء مع مرشد" },
    body: {
      en: "Create a teacher profile in My students → Teaching profile (majors, grades, languages you teach). Then open Studio, pick what to make, and tell Murchid the topic.",
      ar: "أنشئ ملف المعلّم من «طلابي ← الملف التدريسي» (المواد، الصفوف، واللغات التي تدرّسها). ثم افتح الاستوديو، اختر ما تريد إنشاءه، وأخبر مرشد بالموضوع.",
    },
  },
  {
    id: "studio-chips",
    title: { en: "Studio settings vs. your prompt", ar: "إعدادات الاستوديو مقابل نصّ الطلب" },
    body: {
      en: "The chips above the textarea (Grade, Major, Language, Duration…) are HARD constraints. If your prompt mentions a different value, Murchid will warn you before generating. Pick 'Use settings' to let the chips win.",
      ar: "الإعدادات أعلى مربع النص (الصف، المادة، اللغة، المدة…) قيود صارمة. إذا ذكر النصّ قيمة مختلفة، سينبّهك مرشد قبل الإنشاء. اختر «استخدم الإعدادات» ليتقدّم الإعداد على النص.",
    },
  },
  {
    id: "output-language",
    title: { en: "How output language is decided", ar: "كيف تُحدَّد لغة المخرَجات" },
    body: {
      en: "By default, Murchid writes in the language of your UI (Arabic UI → Arabic output). To force a specific language, pick it in the Language chip. To let Murchid choose, leave the chip on Auto.",
      ar: "افتراضيًا، يكتب مرشد بلغة الواجهة (واجهة عربية → مخرجات عربية). لاختيار لغة محددة، اختَرها من إعداد اللغة. للسماح لمرشد بالاختيار، اترك الإعداد على «تلقائي».",
    },
  },
  {
    id: "attach-files",
    title: { en: "Attach an image or PDF", ar: "إرفاق صورة أو PDF" },
    body: {
      en: "Click the paperclip in the studio prompt card and pick an image (PNG/JPG/WebP/GIF) or PDF. Murchid will base the output on the file. Use the textarea for extra guidance like 'only the formulas'.",
      ar: "اضغط على رمز المشبك في بطاقة الطلب واختر صورة (PNG/JPG/WebP/GIF) أو ملف PDF. سيستند مرشد إلى الملف في المخرَجات. استخدم مربع النص لتوجيهات إضافية مثل «الصيغ فقط».",
    },
  },
  {
    id: "saving-drafts",
    title: { en: "Saving and reopening drafts", ar: "حفظ المسودات وفتحها لاحقًا" },
    body: {
      en: "Every generation auto-saves as a draft. Open Lesson Plans / Quizzes / Homework / Presentations from the sidebar to find them. Click the title to keep editing.",
      ar: "تُحفَظ كل عملية إنشاء كمسوّدة تلقائيًا. افتح «خطط الدروس / الاختبارات / الواجبات / العروض» من الشريط الجانبي للوصول إليها. اضغط على العنوان لمتابعة التحرير.",
    },
  },
  {
    id: "accessibility",
    title: { en: "Accessibility tools", ar: "أدوات الإتاحة" },
    body: {
      en: "The orange button in the bottom corner opens text-size, dyslexia-friendly font, high-contrast, color-blind palettes, big cursor, link highlighting, read-aloud, and more. Settings save per device.",
      ar: "الزر البرتقالي في الزاوية السفلية يفتح أدوات تكبير النص، وخطًا صديقًا لعسر القراءة، وتباينًا عاليًا، ولوحات لعمى الألوان، ومؤشّرًا كبيرًا، وإبراز الروابط، والقراءة الصوتية، وغيرها. تُحفَظ الإعدادات على الجهاز.",
    },
  },
];

export default function HelpPopover({ open, onClose }) {
  const t = useT();
  const { lang, dir } = useI18n();
  const [query, setQuery] = useState("");
  const [openArticle, setOpenArticle] = useState(null);

  // Reset to list view + clear search every time the popover reopens.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setOpenArticle(null);
    }
  }, [open]);

  // Close on Escape — same affordance as the rest of the app's modals.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_ARTICLES;
    return HELP_ARTICLES.filter((a) => {
      const title = (a.title[lang] || a.title.en).toLowerCase();
      const body = (a.body[lang] || a.body.en).toLowerCase();
      return title.includes(q) || body.includes(q);
    });
  }, [query, lang]);

  if (!open) return null;

  const article = openArticle
    ? HELP_ARTICLES.find((a) => a.id === openArticle)
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      dir={dir}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-paper-cool w-full sm:w-[420px] sm:max-w-[92vw] max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Dark header with title + close */}
        <div className="bg-ink text-paper-cool px-6 pt-5 pb-6 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("help.close")}
            className="absolute top-3 end-3 h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70 mb-3">
            {t("help.eyebrow")}
          </p>
          <h2 className="font-serif text-2xl font-medium leading-tight">
            {t("help.headlineA")}<br />
            {t("help.headlineB")}
          </h2>
        </div>

        {/* Body — either article reader or the menu */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {article ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setOpenArticle(null)}
                className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition-colors"
              >
                <ArrowLeft size={14} className="rtl:rotate-180" />
                {t("help.back")}
              </button>
              <h3 className="font-serif text-xl font-medium text-ink leading-tight">
                {article.title[lang] || article.title.en}
              </h3>
              <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">
                {article.body[lang] || article.body.en}
              </p>
            </div>
          ) : (
            <>
              {/* Status pill (decorative — no real probe) */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line bg-paper">
                <CheckCircle2 size={18} className="text-sage flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink leading-tight">
                    {t("help.statusOk")}
                  </p>
                </div>
              </div>

              {/* Send us a message → mailto */}
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("help.mailSubject"))}`}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line bg-paper hover:border-accent hover:bg-paper-warm transition-colors"
              >
                <span className="flex-1 text-sm font-medium text-ink">
                  {t("help.sendMessage")}
                </span>
                <Send size={16} className="text-accent rtl:rotate-180" />
              </a>

              {/* Search + article list */}
              <div className="rounded-xl border border-line bg-paper">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
                  <Search size={16} className="text-ink-soft flex-shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("help.searchPlaceholder")}
                    className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted outline-none"
                  />
                </div>
                <ul>
                  {filtered.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-muted italic">
                      {t("help.noResults")}
                    </li>
                  ) : (
                    filtered.map((a) => (
                      <li key={a.id} className="border-t border-line first:border-t-0">
                        <button
                          type="button"
                          onClick={() => setOpenArticle(a.id)}
                          className="w-full flex items-center gap-2 px-4 py-3 text-start hover:bg-paper-warm transition-colors"
                        >
                          <span className="flex-1 text-sm text-ink leading-snug">
                            {a.title[lang] || a.title.en}
                          </span>
                          <ChevronRight size={14} className="text-muted flex-shrink-0 rtl:rotate-180" />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
