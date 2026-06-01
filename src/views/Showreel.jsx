// =====================================================================
// Murchid — Showreel ("Watch it draft")
//
// A cinematic product film on a dark stage. The framed "studio screen"
// recreates the real AI Studio and plays the full flow for each kind:
//   compose  →  "Murchid is drafting…"  →  the finished result.
// The chips mirror the studio's own "Switch to" kinds (Lesson / Quiz /
// Homework / Presentation). It auto-cycles through them and any chip can
// be clicked to jump; "Make it" triggers the draft→result; hovering
// pauses. Bilingual via useT() (+ a local result set per lang);
// reduced-motion freezes on a finished result.
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import { FileText, GraduationCap, ClipboardList, Layers } from "lucide-react";
import { useT, useI18n } from "../lib/i18n";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const KINDS = [
  { v: "presentation", Icon: Layers },
  { v: "lesson_plan", Icon: FileText },
  { v: "quiz", Icon: GraduationCap },
  { v: "homework", Icon: ClipboardList },
];

// Phase timing (ms). compose → drafting → result, then next kind. The
// presentation result holds longer so its slide-editor animation can play.
const COMPOSE_MS = 2600;
const DRAFT_MS = 1500;
const RESULT_MS = 3400;
const PRESO_RESULT_MS = 5800;
const resultMsFor = (kv) => (kv === "presentation" ? PRESO_RESULT_MS : RESULT_MS);

// What each "Make it" produces — a realistic artifact per kind (presentation
// uses the live slide-editor mockup instead). Local, picked by lang.
const RESULTS = {
  lesson_plan: {
    en: {
      title: "Photosynthesis",
      meta: ["Grade 7", "45 min"],
      objective: "Goal — how plants turn light into food",
      rows: [
        { tag: "00–05", text: "Hook — a wilting plant by the window" },
        { tag: "05–20", text: "Light + water + CO₂ → glucose + O₂" },
      ],
    },
    ar: {
      title: "البناء الضوئي",
      meta: ["الصف ٧", "٤٥ دقيقة"],
      objective: "الهدف — كيف تصنع النباتات غذاءها من الضوء",
      rows: [
        { tag: "٠٠–٠٥", text: "تمهيد — نبتة ذابلة قرب النافذة" },
        { tag: "٠٥–٢٠", text: "ضوء + ماء + ثاني أكسيد الكربون ← غلوكوز" },
      ],
    },
  },
  quiz: {
    en: {
      questions: [
        { tag: "Q1", badge: "MCQ", stem: "Which gas do plants absorb?",
          opts: [{ t: "Oxygen" }, { t: "Carbon dioxide", ok: true }, { t: "Nitrogen" }] },
        { tag: "Q2", badge: "T / F", stem: "Plants need light at night.",
          opts: [{ t: "True" }, { t: "False", ok: true }] },
      ],
    },
    ar: {
      questions: [
        { tag: "١", badge: "اختياري", stem: "أيّ غاز تمتصّه النباتات؟",
          opts: [{ t: "الأكسجين" }, { t: "ثاني أكسيد الكربون", ok: true }, { t: "النيتروجين" }] },
        { tag: "٢", badge: "صح / خطأ", stem: "تحتاج النباتات إلى الضوء ليلًا.",
          opts: [{ t: "صح" }, { t: "خطأ", ok: true }] },
      ],
    },
  },
  homework: {
    en: {
      title: "Reading comprehension",
      due: "Due Thu",
      rows: [
        { tag: "1", text: "Read the short story · pp. 12–15" },
        { tag: "2", text: "Answer 5 questions in writing" },
        { tag: "3", text: "Write a three-sentence summary" },
      ],
    },
    ar: {
      title: "الفهم القرائي",
      due: "التسليم الخميس",
      rows: [
        { tag: "١", text: "اقرأ القصة القصيرة · ص ١٢–١٥" },
        { tag: "٢", text: "أجب عن ٥ أسئلة كتابةً" },
        { tag: "٣", text: "اكتب ملخصًا من ثلاث جمل" },
      ],
    },
  },
};

// Reveal as the section passes through the viewport (motion tied to scroll).
function useViewportProgress(ref) {
  const [vp, setVp] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVp(1);
      return undefined;
    }
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        setVp(clamp01((vh - r.top) / (vh + r.height)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
  return vp;
}

export default function Showreel() {
  const t = useT();
  const { lang } = useI18n();
  const ref = useRef(null);
  const vp = useViewportProgress(ref);
  const reveal = easeInOut(clamp01((vp - 0.04) / 0.3));

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [active, setActive] = useState(0);
  // compose → drafting → result. Reduced motion freezes on a result.
  const [phase, setPhase] = useState(reduced ? "result" : "compose");
  const [paused, setPaused] = useState(false);

  // Section-title typewriter — the last word of "From one line, the whole
  // lesson." retypes to match the kind the showreel is drafting, like a person
  // backspacing then typing. Lags `active`; only the word animates (the rest
  // of the title is static).
  const titleWordFor = (i) => t(`film.title.word.${KINDS[i].v}`);
  const [titleWord, setTitleWord] = useState(() => titleWordFor(0));
  const [typing, setTyping] = useState(false);
  const wordRef = useRef(titleWord);
  const langRef = useRef(lang);
  const applyWord = (w) => { wordRef.current = w; setTitleWord(w); };

  useEffect(() => {
    if (reduced || paused) return undefined;
    const ms =
      phase === "compose" ? COMPOSE_MS : phase === "drafting" ? DRAFT_MS : resultMsFor(KINDS[active].v);
    const id = setTimeout(() => {
      if (phase === "compose") setPhase("drafting");
      else if (phase === "drafting") setPhase("result");
      else {
        setActive((a) => (a + 1) % KINDS.length);
        setPhase("compose");
      }
    }, ms);
    return () => clearTimeout(id);
  }, [phase, active, reduced, paused]);

  // Retype the title's last word when the active kind changes (auto-cycle or
  // click): backspace the old word, then type the new one. A language flip
  // swaps instantly (no half-deleted English word turning into Arabic).
  useEffect(() => {
    const target = t(`film.title.word.${KINDS[active].v}`);
    if (reduced) {
      applyWord(target);
      setTyping(false);
      langRef.current = lang;
      return undefined;
    }
    if (langRef.current !== lang) {
      langRef.current = lang;
      applyWord(target);
      setTyping(false);
      return undefined;
    }
    const cur = wordRef.current;
    if (cur === target) return undefined;
    let cancelled = false;
    const timers = [];
    setTyping(true);
    let delay = 0;
    for (let i = cur.length - 1; i >= 0; i--) {
      delay += 42;
      const j = i;
      timers.push(setTimeout(() => { if (!cancelled) applyWord(cur.slice(0, j)); }, delay));
    }
    delay += 150;
    for (let i = 1; i <= target.length; i++) {
      delay += 66;
      const j = i;
      timers.push(setTimeout(() => { if (!cancelled) applyWord(target.slice(0, j)); }, delay));
    }
    timers.push(setTimeout(() => { if (!cancelled) setTyping(false); }, delay + 60));
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, lang, reduced]);

  const selectKind = (i) => {
    setActive(i);
    setPhase(reduced ? "result" : "compose");
  };
  const makeIt = () => {
    if (phase === "compose") setPhase("drafting");
  };

  const k = KINDS[active];
  const ActiveIcon = k.Icon;
  const R = RESULTS[k.v] ? RESULTS[k.v][lang === "ar" ? "ar" : "en"] : null;
  const readyWord = lang === "ar" ? "جاهز" : "Ready";
  const phaseMs = phase === "compose" ? COMPOSE_MS : phase === "drafting" ? DRAFT_MS : resultMsFor(k.v);

  return (
    <section ref={ref} className="film-stage">
      <div className="film-pin">
        <div className="film-grain" aria-hidden="true" />
        <div
          className="film-shell"
          style={{ opacity: reveal, transform: `translateY(${lerp(48, 0, reveal)}px)` }}
        >
          <header className="film-head">
            <span className="film-eyebrow">{t("film.eyebrow")}</span>
            <h2 className="film-title">
              {t("film.title.a")}{" "}
              <em>
                {t("film.title.before")}
                <span className="film-title-word">{titleWord}</span>
                {typing && <span className="film-title-caret" aria-hidden="true" />}
                {t("film.title.after")}
              </em>
            </h2>
            <p className="film-sub">{t("film.sub")}</p>
          </header>

          {/* No scroll-scale on the frame — the tablet stays one fixed size at
              any scroll position; the shell's fade/rise carries the reveal. */}
          <div className="film-frame">
            <div className="film-bezel">
              <span className="film-rec" aria-hidden="true">
                <span className="film-rec-dot" />
                REC
              </span>
              <div
                className="film-screen"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
              >
                <div className="film-titlebar" aria-hidden="true">
                  <span className="film-dot" />
                  <span className="film-dot" />
                  <span className="film-dot" />
                  <span className="film-windowtitle">{t("film.windowTitle")}</span>
                </div>

                <p className="film-compose-head">
                  {t(`kind.${k.v}.verb`)}{" "}
                  <span className="film-kindpill">
                    <ActiveIcon size={15} strokeWidth={2} aria-hidden="true" />
                    {t(`kind.${k.v}`)}
                  </span>
                  . {t(`kind.${k.v}.suffix`)}
                </p>

                {/* The box transforms through the flow: prompt → drafting → result. */}
                <div className="film-promptbox">
                  {phase === "compose" && (
                    <div className="film-compose-body" key="compose">
                      <p className="film-prompttext">
                        {t(`kind.${k.v}.sample`)}
                        <span className="film-caret" aria-hidden="true" />
                      </p>
                      <div className="film-composebar">
                        <span className="film-oneliner">{t(`kind.${k.v}.oneliner`)}</span>
                        <span className="film-willfill">{t("studio.caption.willFill")}</span>
                        <button type="button" className="film-makeit" onClick={makeIt}>
                          {t("studio.makeIt")} →
                        </button>
                      </div>
                    </div>
                  )}

                  {phase === "drafting" && (
                    <div className="film-drafting" key="drafting">
                      <span className="film-drafting-label">
                        <span className="film-spinner" aria-hidden="true" />
                        {t("film.drafting")}
                      </span>
                      <div className="film-skel" aria-hidden="true">
                        <span /><span /><span /><span />
                      </div>
                    </div>
                  )}

                  {phase === "result" && k.v === "presentation" && (
                    <div className="film-result film-deck" key="result">
                      <span className="film-result-head">
                        <span className="film-result-check" aria-hidden="true" />
                        {t(`kind.${k.v}`)} · {readyWord}
                      </span>
                      <div className="film-deck-stage" aria-hidden="true">
                        <div className="film-deck-rail">
                          <span className="film-deck-thumb is-active" />
                          <span className="film-deck-thumb" />
                          <span className="film-deck-thumb" />
                          <span className="film-deck-thumb" />
                        </div>
                        <div className="film-deck-canvas">
                          <span className="film-deck-no">01</span>
                          <span className="film-deck-slide-title">
                            {lang === "ar" ? "دورة الماء" : "The Water Cycle"}
                          </span>
                          <span className="film-deck-slide-art" />
                        </div>
                        <div className="film-deck-panel">
                          <span className="film-deck-panel-label">
                            {lang === "ar" ? "الخلفية" : "Background"}
                          </span>
                          <div className="film-deck-swatches">
                            <span className="film-deck-sw s1" />
                            <span className="film-deck-sw s2" />
                            <span className="film-deck-sw s3" />
                            <span className="film-deck-sw s4" />
                            <svg className="film-deck-cursor" viewBox="0 0 16 16" width="15" height="15">
                              <path d="M1 1l4.6 12.5 2-4.9 4.9-2z" fill="#1a1814" stroke="#f7f3ec" strokeWidth="1.1" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <span className="film-deck-panel-label">
                            {lang === "ar" ? "نص · صورة" : "Text · Image"}
                          </span>
                          <div className="film-deck-controls">
                            <span />
                            <span />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {phase === "result" && k.v === "lesson_plan" && R && (
                    <div className="film-result" key="result">
                      <span className="film-result-head">
                        <span className="film-result-check" aria-hidden="true" />
                        {t(`kind.${k.v}`)} · {readyWord}
                      </span>
                      <div className="film-lp-top">
                        <span className="film-lp-title">{R.title}</span>
                        {R.meta.map((m, i) => (
                          <span key={i} className="film-lp-chip">{m}</span>
                        ))}
                      </div>
                      <span className="film-lp-obj">{R.objective}</span>
                      <ul className="film-result-rows">
                        {R.rows.map((r, i) => (
                          <li key={i} className="film-result-row" style={{ "--i": i }}>
                            <span className="film-result-tag">{r.tag}</span>
                            <span className="film-result-text">{r.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {phase === "result" && k.v === "quiz" && R && (
                    <div className="film-result film-qz" key="result">
                      <span className="film-result-head">
                        <span className="film-result-check" aria-hidden="true" />
                        {t(`kind.${k.v}`)} · {readyWord}
                      </span>
                      {R.questions.map((q, qi) => (
                        <div key={qi} className="film-qz-q" style={{ "--i": qi }}>
                          <div className="film-qz-stem">
                            <span className="film-qz-tag">{q.tag}</span>
                            <span className="film-qz-text">{q.stem}</span>
                            <span className="film-qz-badge">{q.badge}</span>
                          </div>
                          <div className="film-qz-opts">
                            {q.opts.map((o, oi) => (
                              <span key={oi} className={`film-qz-opt${o.ok ? " is-correct" : ""}`}>
                                {o.t}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {phase === "result" && k.v === "homework" && R && (
                    <div className="film-result" key="result">
                      <span className="film-result-head">
                        <span className="film-result-check" aria-hidden="true" />
                        {t(`kind.${k.v}`)} · {readyWord}
                      </span>
                      <div className="film-hw-top">
                        <span className="film-hw-title">{R.title}</span>
                        <span className="film-hw-due">{R.due}</span>
                      </div>
                      <ul className="film-result-rows">
                        {R.rows.map((r, i) => (
                          <li key={i} className="film-result-row" style={{ "--i": i }}>
                            <span className="film-result-tag">{r.tag}</span>
                            <span className="film-result-text">{r.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Switcher — the studio's own "Switch to" kinds. */}
                <div className="film-switch">
                  <span className="film-switch-label">{t("studio.menu.switchTo")}</span>
                  <div className="film-tabs" role="tablist" aria-label={t("studio.menu.switchTo")}>
                    {KINDS.map((kk, i) => {
                      const I = kk.Icon;
                      return (
                        <button
                          key={kk.v}
                          type="button"
                          role="tab"
                          aria-selected={i === active}
                          className={`film-tab${i === active ? " is-active" : ""}`}
                          onClick={() => selectKind(i)}
                        >
                          <I size={14} strokeWidth={2} aria-hidden="true" />
                          {t(`kind.${kk.v}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Phase progress — fills over the current phase. */}
                <div className="film-progress" aria-hidden="true">
                  <span
                    className="film-progress-bar"
                    key={`${active}-${phase}`}
                    style={{ animationDuration: `${phaseMs}ms`, animationPlayState: paused ? "paused" : "running" }}
                  />
                </div>

                <div className="film-footer">
                  <span className="film-ready">{t("film.ready")}</span>
                  <span className="film-cred">{t("film.cred")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
