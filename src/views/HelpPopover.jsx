"use client";

// Claude-style help popover. Opens from the account menu.
// Three rows: send us a message (mailto), search-for-help input, FAQ list.
// No AI answers — articles are static and live in HELP_ARTICLES below.
// Modeled after Claude's in-product help so the shape feels familiar.
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Send, Sparkles, CheckCircle2, ChevronRight, ArrowLeft,
  MessageSquare, HelpCircle,
} from "lucide-react";
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

// Two bottom tabs:
//   help     — status pill + send-us-a-message link + search + articles
//   messages — textarea composer; Send opens the user's mail client with
//              the typed body pre-filled to SUPPORT_EMAIL
// A previous version had a third "Home" tab that duplicated Help — dropped.

export default function HelpPopover({ open, onClose }) {
  const t = useT();
  const { lang, dir } = useI18n();
  const [query, setQuery] = useState("");
  const [openArticle, setOpenArticle] = useState(null);
  const [tab, setTab] = useState("help");
  const [messageDraft, setMessageDraft] = useState("");

  // Reset state every time the popover reopens.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setOpenArticle(null);
      setTab("help");
      setMessageDraft("");
    }
  }, [open]);

  // Close on Escape — same affordance as the rest of the app's modals.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Token-based scoring against article title + body. Title matches
  // weigh 3× body matches. Returns scored articles ordered best→worst.
  // Used both for live filtering (anything > 0) and for "Ask Murchid"
  // (best-scoring article when the teacher hits Enter).
  const scored = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_ARTICLES.map((a) => ({ article: a, score: 0 }));
    // Tokens: 2+ char words, deduped. Latin + Arabic word chars.
    const tokens = Array.from(
      new Set(q.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2))
    );
    if (tokens.length === 0) return HELP_ARTICLES.map((a) => ({ article: a, score: 0 }));
    return HELP_ARTICLES
      .map((a) => {
        const title = (a.title[lang] || a.title.en).toLowerCase();
        const body = (a.body[lang] || a.body.en).toLowerCase();
        let score = 0;
        for (const tok of tokens) {
          if (title.includes(tok)) score += 3;
          if (body.includes(tok)) score += 1;
        }
        return { article: a, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, lang]);

  const filtered = useMemo(
    () => (query.trim() ? scored.map((s) => s.article) : HELP_ARTICLES),
    [scored, query]
  );

  // "Ask Murchid": fire on Enter. Opens the top-scoring article as the
  // bot's answer. If nothing scored above zero, route to Messages so
  // the teacher can write to support instead.
  const askMurchid = () => {
    const q = query.trim();
    if (!q) return;
    if (scored.length > 0 && scored[0].score > 0) {
      setOpenArticle(scored[0].article.id);
    } else {
      // No good match — pre-fill the message composer with the question.
      setMessageDraft(q);
      setTab("messages");
    }
  };

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

        {/* Body — article reader, or the tab content */}
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
          ) : tab === "messages" ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft leading-relaxed">
                {t("help.messagesIntro")}
              </p>
              <div className="rounded-xl border border-line bg-paper overflow-hidden">
                <textarea
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  placeholder={t("help.messagesPlaceholder")}
                  rows={6}
                  className="w-full bg-transparent px-4 py-3 text-sm text-ink placeholder:text-muted outline-none resize-y"
                />
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-line bg-paper-cool">
                  <p className="text-[11px] text-muted truncate">
                    {t("help.messagesTo")}{SUPPORT_EMAIL}
                  </p>
                  <a
                    href={
                      messageDraft.trim()
                        ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("help.mailSubject"))}&body=${encodeURIComponent(messageDraft)}`
                        : undefined
                    }
                    onClick={(e) => { if (!messageDraft.trim()) e.preventDefault(); }}
                    aria-disabled={!messageDraft.trim()}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      messageDraft.trim()
                        ? "bg-ink text-paper-cool hover:bg-ink-soft"
                        : "bg-line text-muted cursor-default"
                    }`}
                  >
                    <Send size={13} className="rtl:rotate-180" />
                    {t("help.sendBtn")}
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Status pill */}
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

              {/* Ask Murchid — type a question, hit Enter to get the
                  best-matching article inline. Typing also live-filters
                  the list below. No LLM, just keyword scoring against
                  the FAQ. */}
              <div className="rounded-xl border border-line bg-paper">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
                  <Sparkles size={15} className="text-accent flex-shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        askMurchid();
                      }
                    }}
                    placeholder={t("help.askPlaceholder")}
                    className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted outline-none"
                  />
                  {query.trim() && (
                    <button
                      type="button"
                      onClick={askMurchid}
                      className="text-[11px] font-medium text-accent hover:underline shrink-0"
                    >
                      {t("help.askEnter")}
                    </button>
                  )}
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

        {/* Bottom tab bar — Help is the article list (default), Messages
            is the composer. Removed the duplicate Home tab. */}
        <nav className="grid grid-cols-2 border-t border-line bg-paper-cool">
          <TabBtn
            icon={HelpCircle}
            label={t("help.tab.help")}
            active={tab === "help"}
            onClick={() => { setTab("help"); setOpenArticle(null); }}
          />
          <TabBtn
            icon={MessageSquare}
            label={t("help.tab.messages")}
            active={tab === "messages"}
            onClick={() => { setTab("messages"); setOpenArticle(null); }}
          />
        </nav>
      </div>
    </div>,
    document.body
  );
}

function TabBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
        active ? "text-accent" : "text-muted hover:text-ink-soft"
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.75} />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
