// Murchid — Landing v3.1 "The Teacher's Atelier"
// Full rewrite from v1.1's 5,575-line scroll choreography. Premium 2026
// editorial calm — paper surfaces, italic Instrument Serif moments,
// framer-motion scroll reveals, kinetic hero typography, magnetic CTAs.
// One file, ~900 lines. Responsive: mobile 375 → tablet 1024 → desktop 1440+.
import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useSpring,
} from "framer-motion";
import {
  ArrowRight, ArrowUpRight, BookOpen, GraduationCap, ClipboardList,
  Presentation, Sparkles, Library, CalendarDays,
  Globe2, Brain, ChevronDown, Play, Menu, X,
  CheckCircle2, Clock, Languages,
} from "lucide-react";
import "../landing.css";
import { LangToggle } from "../lib/i18n";

// ────────────────────────────────────────────────────────────────────
// Motion primitives shared across sections.
// ────────────────────────────────────────────────────────────────────
const EASE_OUT = [0.22, 1, 0.36, 1];

// Fade + 24px lift on view. Used by section blocks.
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

// Staggered children — used by sections that have a list of cards.
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

// Word-by-word reveal for the hero headline.
function KineticWords({ children, delay = 0, accent = false, className = "" }) {
  const words = String(children).split(" ");
  return (
    <motion.span
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06, delayChildren: delay } },
      }}
      className={["inline-block", accent ? "text-accent italic font-normal" : "", className].join(" ")}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block"
          variants={{
            hidden: { opacity: 0, y: "0.6em", filter: "blur(6px)" },
            show: {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              transition: { duration: 0.7, ease: EASE_OUT },
            },
          }}
        >
          {word}
          {i < words.length - 1 && " "}
        </motion.span>
      ))}
    </motion.span>
  );
}

// Magnetic-hover wrapper for CTAs.
function Magnetic({ children, strength = 0.18, className = "" }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    x.set(dx * strength);
    y.set(dy * strength);
  };
  const reset = () => { x.set(0); y.set(0); };
  return (
    <motion.span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy, display: "inline-block" }}
      className={className}
    >
      {children}
    </motion.span>
  );
}

// Section + reveal helpers.
function Section({ children, className = "", id, py = "py-20 md:py-28 lg:py-32" }) {
  return (
    <section id={id} className={[py, "relative", className].join(" ")}>
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">{children}</div>
    </section>
  );
}

function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px -15% 0px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={fadeUp}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Nav — sticky, transparent → opaque on scroll, mobile drawer.
// ────────────────────────────────────────────────────────────────────
function LandingNav({ onOpenStudio }) {
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ["rgba(247,242,232,0)", "rgba(247,242,232,0.86)"]);
  const border = useTransform(scrollY, [0, 80], ["rgba(31,27,20,0)", "rgba(31,27,20,0.08)"]);
  const [open, setOpen] = useState(false);

  const links = [
    { label: "How it works", href: "#how" },
    { label: "Tools", href: "#tools" },
    { label: "Bilingual", href: "#bilingual" },
    { label: "Pricing", href: "#pricing" },
  ];

  return (
    <motion.nav
      style={{ background: bg, borderColor: border }}
      className="fixed top-0 inset-x-0 z-50 backdrop-blur-md border-b transition-colors"
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-16 flex items-center gap-6">
        <a href="#top" className="inline-flex items-center gap-2.5 group" aria-label="Murchid">
          <span className="grid place-items-center w-7 h-7 rounded-md bg-ink text-paper font-serif italic text-[14px] leading-none transition-transform duration-150 group-hover:scale-105">
            M
          </span>
          <span className="font-serif italic text-[19px] text-ink leading-none">Murchid</span>
        </a>

        <div className="hidden md:flex items-center gap-7 ms-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-[13.5px] text-ink-soft hover:text-ink transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <span className="flex-1" />

        <div className="hidden md:flex items-center gap-3">
          <LangToggle />
          <button
            onClick={onOpenStudio}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-ink text-paper text-[13px] font-medium hover:bg-ink-soft transition-colors group"
          >
            Open Studio
            <ArrowRight size={13} className="transition-transform duration-150 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </button>
        </div>

        <button onClick={() => setOpen(true)} className="md:hidden h-10 w-10 grid place-items-center text-ink" aria-label="Open menu">
          <Menu size={20} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-[60] bg-paper"
          >
            <div className="h-16 flex items-center px-6 border-b border-line">
              <span className="font-serif italic text-[20px] text-ink">Murchid</span>
              <span className="flex-1" />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="h-10 w-10 grid place-items-center">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-10 flex flex-col gap-6">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="font-serif text-[28px] text-ink"
                >
                  {l.label}
                </a>
              ))}
              <div className="h-px bg-line my-2" />
              <button
                onClick={() => { setOpen(false); onOpenStudio(); }}
                className="inline-flex items-center justify-center gap-2 h-12 rounded-full bg-ink text-paper text-[14px] font-medium"
              >
                Open Studio
                <ArrowRight size={14} className="rtl:rotate-180" />
              </button>
              <LangToggle />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ────────────────────────────────────────────────────────────────────
// HERO — kinetic italic display + live drafting demo card.
// ────────────────────────────────────────────────────────────────────
function Hero({ onOpenStudio }) {
  return (
    <section id="top" className="relative pt-32 md:pt-40 pb-24 md:pb-32 overflow-hidden">
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-[640px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 30% 0%, color-mix(in oklab, var(--color-accent) 7%, transparent), transparent 70%)",
        }}
      />

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 relative">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft mb-7 inline-flex items-center gap-2.5"
            >
              <span className="w-6 h-px bg-accent" />
              For teachers, KG–G12 · UAE & beyond
            </motion.p>

            <h1 className="font-serif text-[44px] sm:text-[56px] md:text-[68px] lg:text-[84px] text-ink leading-[0.95] tracking-[-0.015em]">
              <span className="block">
                <KineticWords delay={0.05}>Lesson prep</KineticWords>
              </span>
              <span className="block">
                <KineticWords delay={0.25}>in</KineticWords>{" "}
                <KineticWords delay={0.35} accent>thirty</KineticWords>
              </span>
              <span className="block">
                <KineticWords delay={0.55}>seconds.</KineticWords>
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.85, ease: EASE_OUT }}
              className="mt-7 max-w-[28rem] text-[16px] md:text-[17px] leading-[1.65] text-ink-soft"
            >
              Murchid is an AI lesson director. Type a topic — get a complete
              teaching package: plan, slides, worksheet, quiz, homework.
              Aligned to your curriculum. English and Arabic.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.05, ease: EASE_OUT }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Magnetic>
                <button
                  onClick={onOpenStudio}
                  className="group inline-flex items-center gap-2 h-12 px-6 rounded-full bg-ink text-paper text-[14px] font-medium hover:bg-ink-soft transition-colors"
                >
                  Try the prototype
                  <ArrowRight
                    size={15}
                    className="transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  />
                </button>
              </Magnetic>
              <a
                href="#how"
                className="group inline-flex items-center gap-1.5 h-12 px-4 text-[14px] font-medium text-ink-soft hover:text-ink transition-colors"
              >
                <span className="grid place-items-center w-7 h-7 rounded-full border border-line group-hover:border-ink transition-colors">
                  <Play size={11} strokeWidth={2.5} className="ms-0.5" />
                </span>
                See how it works
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.25 }}
              className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink-soft"
            >
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-sage" />
                MoE-aligned curricula
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Languages size={13} className="text-sage" />
                Arabic + English
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5">
                <Clock size={13} className="text-sage" />
                ~30s per lesson
              </span>
            </motion.div>
          </div>

          <div className="relative">
            <HeroDemo />
          </div>
        </div>

        <motion.a
          href="#problem"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="hidden lg:inline-flex items-center gap-2 mt-20 text-[12px] uppercase tracking-[0.18em] text-ink-soft font-mono group"
        >
          <span className="inline-block group-hover:translate-y-0.5 transition-transform">
            <ChevronDown size={14} className="text-ink-soft" />
          </span>
          Scroll
        </motion.a>
      </div>
    </section>
  );
}

// Self-cycling demo card.
function HeroDemo() {
  const samples = [
    {
      eyebrow: "Lesson plan · Grade 7 Science",
      title: "Photosynthesis",
      lines: [
        "Objective — explain light + CO₂ + water → glucose + O₂.",
        "Starter (5m) — leaf samples on the desk; ask: \"what's missing?\"",
        "Activity (25m) — Elodea + lamp + beaker. Count O₂ bubbles.",
        "Wrap (10m) — exit ticket: balanced equation, no peeking.",
      ],
    },
    {
      eyebrow: "Quiz · Grade 9 Math",
      title: "Linear equations",
      lines: [
        "Q1 — Solve 2x + 5 = 17. Show one line of work.",
        "Q2 — A taxi costs 12 AED + 3/km. Write the model.",
        "Q3 — Graph y = −x + 4 between x = −2 and 4.",
        "Q4 — Which line is steeper, y = 2x or y = −3x? Why?",
      ],
    },
    {
      eyebrow: "Homework · Grade 6 English",
      title: "A short story response",
      lines: [
        "Read the attached story (10 min).",
        "Question 1 — Who changes the most, and how?",
        "Question 2 — Find one sentence you'd write differently.",
        "Question 3 — Three new words you learned. Define each.",
      ],
    },
  ];

  const [idx, setIdx] = useState(0);
  const sample = samples[idx];

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % samples.length), 8200);
    return () => clearInterval(id);
  }, [samples.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4, ease: EASE_OUT }}
      className="relative"
    >
      <div
        aria-hidden
        className="absolute -inset-8 rounded-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 50%, color-mix(in oklab, var(--color-accent) 10%, transparent), transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="relative rounded-2xl bg-paper-cool border border-line shadow-[0_30px_60px_-30px_rgba(31,27,20,0.18)] overflow-hidden">
        <div className="flex items-center gap-2 h-9 px-4 border-b border-line bg-paper">
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="w-2.5 h-2.5 rounded-full bg-line" />
          <span className="flex-1" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
            Murchid · drafting
          </span>
        </div>

        <div className="p-7 min-h-[380px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft mb-3 inline-flex items-center gap-2">
                <span className="w-3 h-px bg-accent" />
                {sample.eyebrow}
              </p>
              <h3 className="font-serif text-[28px] md:text-[32px] text-ink leading-[1.1] tracking-[-0.01em] mb-5">
                <em className="italic">{sample.title}</em>
              </h3>

              <div className="space-y-2.5">
                {sample.lines.map((line, i) => (
                  <TypedLine key={`${idx}-${i}`} text={line} delay={i * 0.32} />
                ))}
              </div>

              <div className="mt-7 flex items-center gap-2 text-[11px] font-mono text-ink-soft">
                <Sparkles size={11} className="text-accent" />
                <span>4 / 4 sections drafted · 28s</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 px-4 h-12 border-t border-line bg-paper">
          <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-soft">Direct it</span>
          <span className="flex-1" />
          {["Refine", "Slides", "Quiz", "Print"].map((a) => (
            <button
              key={a}
              tabIndex={-1}
              className="text-[11px] font-medium text-ink-soft hover:text-ink h-7 px-2.5 rounded-md hover:bg-paper-warm transition"
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TypedLine({ text, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
      className="flex items-start gap-2.5 text-[13.5px] text-ink leading-[1.55]"
    >
      <span aria-hidden className="mt-[7px] inline-block w-1 h-1 rounded-full bg-accent flex-shrink-0" />
      <span>{text}</span>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────
// SocialProof — thin marquee strip of school / org names.
// ────────────────────────────────────────────────────────────────────
function SocialProof() {
  const items = [
    "UAE MoE pilot",
    "Sharjah English School",
    "GEMS · Wellington",
    "Brighton College · Dubai",
    "Repton",
    "American School of Dubai",
    "Cranleigh",
    "Bahrain Bayan School",
  ];
  return (
    <section className="border-y border-line bg-paper-cool/40 py-6 overflow-hidden">
      <p className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft mb-3">
        In conversation with schools across the GCC
      </p>
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-y-0 start-0 w-24 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to right, var(--color-paper), transparent)" }}
        />
        <div
          aria-hidden
          className="absolute inset-y-0 end-0 w-24 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to left, var(--color-paper), transparent)" }}
        />
        <div className="flex gap-12 marquee-track">
          {[...items, ...items].map((s, i) => (
            <span key={i} className="font-serif italic text-[20px] text-ink-soft whitespace-nowrap shrink-0">
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────
// Problem — single editorial pull-quote.
// ────────────────────────────────────────────────────────────────────
function Problem() {
  return (
    <Section id="problem" py="py-28 md:py-40">
      <Reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft mb-8 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> The teacher's problem
        </p>
      </Reveal>
      <Reveal delay={0.1}>
        <h2 className="font-serif text-[38px] sm:text-[48px] md:text-[64px] lg:text-[80px] text-ink leading-[1.02] tracking-[-0.015em] max-w-[18ch]">
          Teachers don't have a time problem.
          <span className="block">
            They have a <em className="italic text-accent">prep</em> problem.
          </span>
        </h2>
      </Reveal>
      <Reveal delay={0.2}>
        <div className="mt-12 grid sm:grid-cols-3 gap-6 max-w-3xl">
          {[
            { num: "10+", label: "hours a week on prep, after school" },
            { num: "4 / 5", label: "lesson resources reused or scratch-built" },
            { num: "60%", label: "of teachers report prep-related burnout" },
          ].map((s) => (
            <div key={s.num}>
              <div className="font-serif text-[44px] text-ink leading-none tabular-nums">{s.num}</div>
              <p className="mt-2 text-[13px] text-ink-soft leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

// ────────────────────────────────────────────────────────────────────
// HowItWorks — 3 numbered steps.
// ────────────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Type the topic.",
      body: '"Grade 7 photosynthesis, 45 minutes, include a hands-on starter." Plain English or Arabic. Murchid handles the rest.',
    },
    {
      n: "02",
      title: "Murchid drafts.",
      body: "A full teaching package — plan, slides, worksheet, quiz, homework — aligned to MoE outcomes. ~30 seconds.",
    },
    {
      n: "03",
      title: "You direct.",
      body: "Click any section to refine. Swap the activity. Add an extension. Murchid edits in the margin like a thoughtful editor.",
    },
  ];

  return (
    <Section id="how">
      <Reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft mb-6 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> How it works
        </p>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-serif text-[36px] md:text-[52px] lg:text-[64px] text-ink leading-[1.05] tracking-[-0.015em] max-w-[16ch]">
          From topic to taught,{" "}
          <em className="italic text-accent">in three steps</em>.
        </h2>
      </Reveal>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-15% 0px" }}
        variants={stagger}
        className="mt-16 grid md:grid-cols-3 gap-5"
      >
        {steps.map((s) => (
          <motion.div
            key={s.n}
            variants={fadeUp}
            className="relative rounded-2xl border border-line bg-paper-cool p-7 hover:border-ink/30 transition-colors duration-200 group"
          >
            <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-accent mb-7">{s.n}</div>
            <h3 className="font-serif italic text-[26px] text-ink leading-tight mb-3">{s.title}</h3>
            <p className="text-[14.5px] text-ink-soft leading-[1.6]">{s.body}</p>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}

// ────────────────────────────────────────────────────────────────────
// Tools — bento grid with 3D tilt cards.
// ────────────────────────────────────────────────────────────────────
function Tools() {
  const tools = [
    { key: "lesson", icon: BookOpen, title: "Lesson plans", body: "45-min lesson with starter, activities, exit ticket. Aligned to your outcomes.", span: "md:col-span-2", large: true },
    { key: "quiz", icon: GraduationCap, title: "Quizzes", body: "MCQ, T/F, short answer, essay. With auto-generated mark scheme." },
    { key: "homework", icon: ClipboardList, title: "Homework", body: "Take-home practice with clear rubric and answer key." },
    { key: "presentation", icon: Presentation, title: "Slide decks", body: "Class-ready slides — paper, ink, projector-safe contrast." },
    { key: "activity", icon: Sparkles, title: "Activities", body: "Pair-work, group tasks, individual exercises with timing." },
    { key: "templates", icon: Library, title: "Templates", body: "Reusable lesson scaffolds. Edit once, reuse forever." },
    { key: "schedule", icon: CalendarDays, title: "Schedule", body: "Every class on one calendar. AI sees the gaps." },
    { key: "studio", icon: Brain, title: "Studio", body: "The director's chair. Chat with Murchid like a colleague.", span: "md:col-span-2", large: true, accent: true },
  ];

  return (
    <Section id="tools">
      <Reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft mb-6 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Inside Murchid
        </p>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-serif text-[36px] md:text-[52px] lg:text-[64px] text-ink leading-[1.05] tracking-[-0.015em] max-w-[16ch]">
          Eight tools. <em className="italic text-accent">One studio</em>.
        </h2>
      </Reveal>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-10% 0px" }}
        variants={stagger}
        className="mt-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4"
      >
        {tools.map((t) => (
          <ToolCard key={t.key} {...t} />
        ))}
      </motion.div>
    </Section>
  );
}

function ToolCard({ icon: Icon, title, body, span = "", large = false, accent = false }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-50, 50], [4, -4]), { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(x, [-50, 50], [-4, 4]), { stiffness: 220, damping: 18 });

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set(e.clientX - r.left - r.width / 2);
    y.set(e.clientY - r.top - r.height / 2);
  };
  const reset = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
      variants={fadeUp}
      className={[
        "relative rounded-2xl border p-6 md:p-7 group cursor-default overflow-hidden",
        accent ? "bg-ink text-paper border-ink" : "bg-paper-cool border-line hover:border-ink/30",
        span,
        large ? "md:min-h-[200px]" : "md:min-h-[180px]",
        "transition-colors duration-200",
      ].join(" ")}
    >
      {accent && (
        <div
          aria-hidden
          className="absolute -inset-1 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 70% 30%, color-mix(in oklab, var(--color-accent) 30%, transparent), transparent 60%)",
          }}
        />
      )}
      <div className="relative flex flex-col h-full">
        <div
          className={[
            "w-10 h-10 rounded-xl grid place-items-center mb-5 transition-transform duration-200 group-hover:scale-110",
            accent ? "bg-paper/10" : "bg-paper border border-line",
          ].join(" ")}
        >
          <Icon size={16} strokeWidth={1.75} className={accent ? "text-paper" : "text-accent"} />
        </div>
        <h3
          className={[
            "font-serif text-[22px] md:text-[24px] leading-tight tracking-[-0.005em] mb-2",
            accent ? "text-paper italic" : "text-ink",
          ].join(" ")}
        >
          {title}
        </h3>
        <p className={["text-[13.5px] leading-[1.55] mt-auto", accent ? "text-paper/70" : "text-ink-soft"].join(" ")}>
          {body}
        </p>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────
// BilingualShowcase — side-by-side EN/AR with real Arabic typography.
// ────────────────────────────────────────────────────────────────────
function BilingualShowcase() {
  return (
    <Section id="bilingual">
      <Reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft mb-6 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Bilingual
        </p>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="font-serif text-[36px] md:text-[52px] lg:text-[64px] text-ink leading-[1.05] tracking-[-0.015em] max-w-[20ch]">
          Built for Arabic. <em className="italic text-accent">Not translated</em>.
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-7 max-w-[42rem] text-[15.5px] text-ink-soft leading-[1.65]">
          Every screen mirrors end-to-end in Arabic. The Arabic face is
          IBM Plex Sans Arabic — a real typeface, sized to match Latin
          headlines optically. Curriculum vocabulary is checked, not
          machine-translated.
        </p>
      </Reveal>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="mt-14 grid md:grid-cols-2 gap-5"
      >
        <BilingualCard
          dir="ltr"
          lang="en"
          eyebrow="LESSON · PHOTOSYNTHESIS"
          title={<>Sunlight, water, and a little chemistry</>}
          body="Students model the photosynthesis equation using leaf samples and a pond-weed bubble count."
          chips={["Grade 7", "45 min", "Science"]}
        />
        <BilingualCard
          dir="rtl"
          lang="ar"
          eyebrow="درس · التمثيل الضوئي"
          title="ضوء الشمس، الماء، وقليل من الكيمياء"
          body="يحاكي الطلاب معادلة التمثيل الضوئي باستخدام عينات أوراق وعد فقاعات الأكسجين من نبات بركة."
          chips={["الصف السابع", "٤٥ دقيقة", "علوم"]}
        />
      </motion.div>
    </Section>
  );
}

function BilingualCard({ dir, lang, eyebrow, title, body, chips }) {
  const arabicStyle = lang === "ar" ? { fontFamily: "'IBM Plex Sans Arabic', sans-serif" } : undefined;
  return (
    <div
      lang={lang}
      dir={dir}
      className="rounded-2xl border border-line bg-paper-cool p-8 md:p-10 hover:border-ink/30 transition-colors duration-200"
    >
      <div className="flex items-center justify-between mb-5">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft" style={arabicStyle}>
          {eyebrow}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-ink-soft">
          <Globe2 size={11} className="text-accent" /> {dir.toUpperCase()}
        </span>
      </div>
      <h3
        className={[
          "text-ink leading-[1.15] tracking-[-0.01em] mb-4",
          lang === "ar" ? "text-[28px] md:text-[32px] font-light" : "font-serif italic text-[28px] md:text-[34px]",
        ].join(" ")}
        style={arabicStyle}
      >
        {title}
      </h3>
      <p className="text-[14px] text-ink-soft leading-[1.7] mb-6" style={arabicStyle}>
        {body}
      </p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span
            key={c}
            className="inline-flex items-center px-2.5 h-6 rounded-full bg-paper border border-line text-[11px] font-medium text-ink-soft"
            style={arabicStyle}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Pricing CTA — single bold message.
// ────────────────────────────────────────────────────────────────────
function PricingCTA({ onOpenStudio }) {
  return (
    <Section id="pricing">
      <Reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft mb-6 inline-flex items-center gap-2.5">
          <span className="w-6 h-px bg-accent" /> Pricing
        </p>
      </Reveal>
      <div className="grid md:grid-cols-[1fr_auto] items-end gap-10">
        <Reveal delay={0.05}>
          <h2 className="font-serif text-[36px] md:text-[52px] lg:text-[64px] text-ink leading-[1.05] tracking-[-0.015em] max-w-[16ch]">
            <em className="italic text-accent">Free</em> during the UAE MoE pilot.
          </h2>
          <p className="mt-6 max-w-[36rem] text-[15.5px] text-ink-soft leading-[1.65]">
            We're onboarding the first 100 teachers ahead of the public
            release. No card. No quotas. We just want your feedback on
            real lessons in real classrooms.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <Magnetic>
            <button
              onClick={onOpenStudio}
              className="group inline-flex items-center gap-2 h-14 px-7 rounded-full bg-ink text-paper text-[15px] font-medium hover:bg-ink-soft transition-colors"
            >
              Join the pilot
              <ArrowUpRight
                size={17}
                className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </button>
          </Magnetic>
        </Reveal>
      </div>
    </Section>
  );
}

// ────────────────────────────────────────────────────────────────────
// FooterCTA — dark ink, massive italic close.
// ────────────────────────────────────────────────────────────────────
function FooterCTA({ onOpenStudio }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section
      ref={ref}
      className="relative py-28 md:py-40 overflow-hidden bg-ink text-paper"
    >
      <motion.div aria-hidden style={{ y }} className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full"
          style={{
            background: "radial-gradient(circle, color-mix(in oklab, var(--color-accent) 28%, transparent), transparent 60%)",
            filter: "blur(80px)",
          }}
        />
      </motion.div>

      <div className="max-w-[1280px] mx-auto px-6 md:px-10 text-center relative">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60 mb-7 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent-soft" /> Start teaching with Murchid
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-serif text-[44px] sm:text-[64px] md:text-[88px] lg:text-[112px] leading-[0.95] tracking-[-0.02em] text-paper">
            Better lessons,
            <span className="block">
              <em className="italic text-accent-soft">less prep</em>.
            </span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="mt-12 flex items-center justify-center">
            <Magnetic strength={0.22}>
              <button
                onClick={onOpenStudio}
                className="group inline-flex items-center gap-3 h-14 px-8 rounded-full bg-paper text-ink text-[15px] font-medium hover:bg-paper-warm transition-colors"
              >
                Open Murchid Studio
                <ArrowRight
                  size={17}
                  className="transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                />
              </button>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────
// Footer — minimal, editorial.
// ────────────────────────────────────────────────────────────────────
function LandingFooter() {
  const cols = [
    { title: "Product", links: ["Lesson plans", "Quizzes", "Homework", "Slides", "Templates"] },
    { title: "Schools", links: ["For UAE MoE", "For private K-12", "Curriculum mapping", "Onboarding"] },
    { title: "Murchid", links: ["About", "Pilot programme", "Privacy", "Contact"] },
  ];
  return (
    <footer className="border-t border-line pt-16 pb-12">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        <div className="grid md:grid-cols-[1.5fr_2fr] gap-12 mb-14">
          <div>
            <span className="font-serif italic text-[28px] text-ink leading-none">Murchid</span>
            <p className="mt-4 max-w-[28ch] text-[13.5px] text-ink-soft leading-[1.65]">
              The AI lesson director for teachers in the UAE and beyond.
              Built with teachers, in conversation with the Ministry of Education.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-8">
            {cols.map((c) => (
              <div key={c.title}>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft mb-4">{c.title}</p>
                <ul className="space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-[13px] text-ink hover:text-accent transition-colors">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="pt-6 border-t border-line flex flex-wrap items-center justify-between gap-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-soft">
            © Murchid 2026 · Made for teachers, in the UAE
          </p>
          <p className="font-serif italic text-[13px] text-ink-soft">
            Calm software for a noisy classroom.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ────────────────────────────────────────────────────────────────────
// Root
// ────────────────────────────────────────────────────────────────────
export default function Landing({ onOpenStudio }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="murchid-landing">
      <LandingNav onOpenStudio={onOpenStudio} />
      <Hero onOpenStudio={onOpenStudio} />
      <SocialProof />
      <Problem />
      <HowItWorks />
      <Tools />
      <BilingualShowcase />
      <PricingCTA onOpenStudio={onOpenStudio} />
      <FooterCTA onOpenStudio={onOpenStudio} />
      <LandingFooter />
    </div>
  );
}
