import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles, ArrowRight, ChevronRight, ChevronLeft, Plus, BookOpen,
  CalendarDays, GraduationCap, ClipboardList, Presentation, Layout,
  Users, MessageCircle, CheckCircle2, Clock, TrendingUp,
} from "lucide-react";
import "../landing.css";

// Animations removed by request. These are no-op stand-ins for the
// framer-motion API so the page renders fully static — no fades, no
// scroll reveals, no entrance motion. Everything is visible at once.
const ANIM_PROPS = new Set([
  "initial", "animate", "exit", "transition", "variants", "custom",
  "whileHover", "whileTap", "whileInView", "viewport", "layout",
  "layoutId", "drag",
]);
const makeMotion = (tag) =>
  React.forwardRef(function MotionShim(props, ref) {
    const clean = {};
    for (const k in props) if (!ANIM_PROPS.has(k)) clean[k] = props[k];
    return React.createElement(tag, { ...clean, ref });
  });
const motion = new Proxy(
  {},
  { get: (cache, tag) => cache[tag] || (cache[tag] = makeMotion(tag)) }
);
const AnimatePresence = ({ children }) => children;
const useScroll = () => ({ scrollYProgress: 0 });
const useTransform = (_v, _in, out) => (Array.isArray(out) ? out[0] : 0);
const useInView = () => true;

// =====================================================================
// SHARED MOTION PRIMITIVES
// =====================================================================
const EASE = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: EASE, delay: i * 0.08 },
  }),
};

const Reveal = ({ children, delay = 0, className = "" }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={fadeUp}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// =====================================================================
// SECTION DIVIDER — hand-drawn ink lines that flow between sections
// =====================================================================
const DIVIDER_PATHS = {
  calm: "M 0 60 C 120 20, 220 70, 340 40 S 540 90, 680 30 S 880 80, 1040 50 S 1240 70, 1440 35",
  cascade:
    "M 0 40 C 100 30, 180 10, 260 25 S 380 80, 500 50 C 580 30, 660 65, 760 95 S 920 80, 1080 60 C 1180 50, 1280 90, 1440 70",
  wave: "M 0 50 C 240 80, 480 20, 720 50 S 1200 80, 1440 50",
  rise: "M 0 80 C 180 60, 320 20, 480 30 S 760 80, 960 60 C 1120 45, 1280 25, 1440 40",
};

const SectionDivider = ({ variant = "calm", flip = false, height = 120 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const path = DIVIDER_PATHS[variant];

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden pointer-events-none select-none"
      style={{ height: `${height}px`, transform: flip ? "scaleY(-1)" : "none" }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="w-full h-full"
        fill="none"
      >
        <motion.path
          d={path}
          stroke="var(--ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2400"
          initial={{ strokeDashoffset: 2400, opacity: 0 }}
          animate={inView ? { strokeDashoffset: 0, opacity: 0.85 } : {}}
          transition={{
            strokeDashoffset: { duration: 2.4, ease: EASE },
            opacity: { duration: 0.6, ease: EASE },
          }}
        />
      </svg>
    </div>
  );
};

// =====================================================================
// NAV
// =====================================================================
const Nav = ({ onOpenStudio }) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "nav-blur border-b" : ""
      }`}
      style={{ borderColor: scrolled ? "var(--line)" : "transparent" }}
    >
      <div className="max-w-[1280px] mx-auto px-8 py-3 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: "var(--ink)" }}
          >
            <span className="font-display text-base" style={{ color: "var(--paper)" }}>
              م
            </span>
          </div>
          <span className="font-display text-xl tracking-tight">Mudir</span>
        </a>

        <nav
          className="hidden md:flex items-center gap-10 text-sm"
          style={{ color: "var(--ink-2)" }}
        >
          <a href="#workflow" className="link-quiet">
            How it works
          </a>
          <a href="#features" className="link-quiet">
            Features
          </a>
          <a href="#studio" className="link-quiet">
            AI studio
          </a>
          <a href="#philosophy" className="link-quiet">
            Philosophy
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenStudio}
            className="hidden sm:block text-sm link-quiet"
            style={{ color: "var(--ink-2)" }}
          >
            Sign in
          </button>
          <a
            href="#cta"
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium"
          >
            Join waitlist
          </a>
        </div>
      </div>
    </motion.header>
  );
};

// =====================================================================
// HERO
// =====================================================================
const Hero = ({ onOpenStudio }) => {
  const orbRef = useRef(null);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  useEffect(() => {
    const onMove = (e) => {
      if (!orbRef.current) return;
      const x = e.clientX - 300;
      const yy = e.clientY - 300;
      orbRef.current.style.transform = `translate(${x}px, ${yy}px)`;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen pt-24 pb-32 overflow-hidden"
    >
      <div ref={orbRef} className="glow-orb" style={{ left: 0, top: 0 }} />

      <motion.div
        style={{ y, opacity }}
        className="relative max-w-[1280px] mx-auto px-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
          className="flex items-center gap-3 mb-10"
        >
          <span className="w-6 h-px" style={{ background: "var(--ink-3)" }} />
          <span className="eyebrow">
            An AI lesson director · Built for UAE schools
          </span>
        </motion.div>

        <h1 className="font-display text-[clamp(56px,9vw,128px)] leading-[0.95] tracking-tight mb-8 max-w-5xl">
          {["The", "teacher", "directs.", ""].map((w, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: EASE, delay: 0.2 + i * 0.08 }}
              className="inline-block mr-[0.25em]"
            >
              {w === "" ? <br /> : w}
            </motion.span>
          ))}
          {["Mudir", "drafts."].map((w, i) => (
            <motion.span
              key={`b${i}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: EASE, delay: 0.5 + i * 0.08 }}
              className="inline-block mr-[0.25em]"
              style={{
                color: i === 0 ? "var(--clay)" : "var(--ink-2)",
                fontStyle: i === 0 ? "italic" : "normal",
              }}
            >
              {w}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.9 }}
          className="text-lg md:text-xl max-w-xl leading-relaxed mb-10"
          style={{ color: "var(--ink-2)" }}
        >
          An AI workspace for teachers, KG through Grade 12. Plan lessons, draft
          quizzes, manage your classroom — all in one calm place.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 1.05 }}
          className="flex flex-wrap items-center gap-3 mb-20"
        >
          <button
            type="button"
            onClick={onOpenStudio}
            className="btn-primary px-6 py-3.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
          >
            Open the planner
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <a
            href="#workflow"
            className="btn-secondary px-6 py-3.5 rounded-lg text-sm font-medium"
          >
            See how it works
          </a>
        </motion.div>

        {/* Break the preview out of the 1280 text column so it spans
            wider and stays responsive (capped at 1700, never wider than
            the viewport — the section clips any overflow). */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: EASE, delay: 1.2 }}
          className="relative left-1/2 -translate-x-1/2 w-screen max-w-[1700px] px-4 sm:px-6 lg:px-10"
        >
          <ProductMock onOpenStudio={onOpenStudio} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: EASE, delay: 1.6 }}
          className="mt-20"
        >
          <p className="eyebrow mb-6">Designed with teachers from</p>
          <div
            className="flex flex-wrap items-center gap-x-10 gap-y-4 font-display text-lg"
            style={{ color: "var(--ink-3)" }}
          >
            <span>GEMS Education</span>
            <span>·</span>
            <span>Aldar Academies</span>
            <span>·</span>
            <span>Taaleem Schools</span>
            <span>·</span>
            <span>Bloom Education</span>
            <span>·</span>
            <span>Innoventures</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

// =====================================================================
// PRODUCT MOCK — the layered hero UI preview
// =====================================================================
const ProductMock = ({ onOpenStudio }) => {
  // Static May 2026 month grid (Mon-start) — mirrors the real Planner.
  const anchor = new Date(2026, 4, 1);
  const today = new Date(2026, 4, 17);
  const todayStart = new Date(2026, 4, 17);
  const sameYMD = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const offset = (anchor.getDay() - 1 + 7) % 7;
  const start = new Date(2026, 4, 1 - offset);
  let grid = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  if (grid[35].getMonth() !== anchor.getMonth()) grid = grid.slice(0, 35);

  const COLOR_STYLES = {
    ink: { dot: "bg-ink", chipBg: "bg-ink/[0.06]", chipText: "text-ink" },
    sage: { dot: "bg-sage", chipBg: "bg-sage/[0.10]", chipText: "text-sage" },
    accent: { dot: "bg-accent", chipBg: "bg-accent/[0.08]", chipText: "text-accent" },
    gold: { dot: "bg-gold", chipBg: "bg-gold/[0.10]", chipText: "text-gold" },
    "accent-soft": { dot: "bg-accent-soft", chipBg: "bg-accent-soft/[0.10]", chipText: "text-accent-soft" },
    muted: { dot: "bg-muted", chipBg: "bg-muted/[0.10]", chipText: "text-muted" },
  };
  const CATEGORIES = [
    { key: "lesson-plans", label: "Lesson Plans", icon: BookOpen, color: "ink" },
    { key: "schedule", label: "Schedule", icon: CalendarDays, color: "sage" },
    { key: "quizzes", label: "Quizzes", icon: GraduationCap, color: "accent" },
    { key: "homework", label: "Homework", icon: ClipboardList, color: "gold" },
    { key: "presentations", label: "Presentations", icon: Presentation, color: "accent-soft" },
    { key: "activities", label: "Activities", icon: Sparkles, color: "muted" },
  ];
  const EVENTS = {
    "2026-05-13": [{ kind: "lesson-plans", title: "The Water Cycle" }],
    "2026-05-16": [{ kind: "schedule", title: "The Water Cycle" }],
    "2026-05-17": [
      { kind: "quizzes", title: "Photosynthesis" },
      { kind: "activities", title: "Lab prep" },
    ],
    "2026-05-19": [
      { kind: "schedule", title: "Statistics intro" },
      { kind: "presentations", title: "Presentation" },
    ],
  };
  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heroChips = [
    { verb: "Generate", noun: "Lesson Plan", icon: BookOpen, color: "accent" },
    { verb: "Create", noun: "Quiz", icon: GraduationCap, color: "sage" },
    { verb: "Build", noun: "Presentation", icon: Layout, color: "accent-soft" },
    { verb: "Plan", noun: "Weekly Schedule", icon: CalendarDays, color: "indigo" },
    { verb: "Analyze", noun: "Students", icon: Users, color: "moss" },
    { verb: "Ask", noun: "Anything", icon: MessageCircle, color: "violet" },
  ];
  const stats = [
    { n: 6, k: "Planned", icon: CalendarDays, iconBg: "bg-ink/[0.08]", iconText: "text-ink" },
    { n: 2, k: "Completed", icon: CheckCircle2, iconBg: "bg-sage/[0.14]", iconText: "text-sage" },
    { n: 4, k: "To do", icon: Clock, iconBg: "bg-accent/[0.12]", iconText: "text-accent" },
  ];
  const upcoming = [
    { m: "MAY", d: "17", t: "Photosynthesis lab" },
    { m: "MAY", d: "17", t: "Quiz · cell respiration" },
    { m: "MAY", d: "19", t: "Statistics introduction" },
    { m: "MAY", d: "19", t: "Term presentation" },
  ];
  const quickActions = [
    { label: "New Lesson Plan", icon: BookOpen, tone: "accent" },
    { label: "New Quiz", icon: ClipboardList, tone: "accent-soft" },
    { label: "New Homework", icon: GraduationCap, tone: "sage" },
    { label: "New Presentation", icon: Presentation, tone: "gold" },
  ];
  const toneToBg = {
    accent: "bg-[rgba(200,71,43,0.12)] text-accent",
    "accent-soft": "bg-[rgba(232,122,85,0.14)] text-accent",
    sage: "bg-[rgba(107,127,90,0.14)] text-sage",
    gold: "bg-[rgba(184,137,61,0.15)] text-gold",
  };

  return (
    <div className="relative">
      <div
        className="mudir-studio-frame rounded-2xl overflow-hidden border border-line bg-paper text-ink font-sans flex"
        style={{ height: 760, boxShadow: "0 40px 100px -25px rgba(26,24,20,0.30)" }}
      >
        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="mudir-sidebar w-64 flex flex-col flex-shrink-0 h-full">
          <div className="mudir-sidebar-brand flex items-center gap-3 px-5 pt-6 pb-4 text-left">
            <span className="mudir-sidebar-brand-mark" aria-hidden>
              M
            </span>
            <span className="font-serif text-[1.4rem] font-medium text-ink leading-none">
              Mudir
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenStudio}
            className="mudir-studio-launcher"
            aria-label="Open AI studio"
          >
            <span className="mudir-studio-launcher-head">
              <span className="mudir-studio-launcher-brand">
                <span className="mudir-studio-launcher-icon" aria-hidden>
                  <Sparkles size={15} strokeWidth={2.25} />
                </span>
                <span className="mudir-studio-launcher-title">Studio</span>
              </span>
              <span className="mudir-studio-launcher-pill">AI</span>
            </span>
            <span className="mudir-studio-launcher-body">
              <span className="mudir-studio-launcher-subtitle">
                Your AI co-pilot for teaching
              </span>
              <span className="mudir-studio-launcher-tagline">
                Create · Plan · Inspire
              </span>
            </span>
            <span className="mudir-studio-launcher-cta">
              <span>Open Studio</span>
              <ArrowRight
                size={14}
                strokeWidth={2.25}
                className="mudir-studio-launcher-cta-arrow"
              />
            </span>
          </button>

          <nav className="px-2 flex-1 overflow-hidden pb-3" aria-label="Primary">
            <section className="mudir-sidebar-section">
              <p className="mudir-sidebar-section-label">Planning</p>
              <div className="space-y-0.5 px-1">
                <div className="mudir-sidebar-item mudir-sidebar-item-active">
                  <span className="mudir-sidebar-badge text-base leading-none">▦</span>
                  <span className="truncate flex-1">Planner</span>
                </div>
              </div>
            </section>
            <section className="mudir-sidebar-section">
              <p className="mudir-sidebar-section-label">Teaching</p>
              <div className="space-y-0.5 px-1">
                {[
                  ["L", "Lesson Plans"],
                  ["Q", "Quizzes"],
                  ["H", "Homework"],
                  ["P", "Presentations"],
                  ["A", "Activities"],
                ].map(([badge, label]) => (
                  <div key={badge} className="mudir-sidebar-item">
                    <span className="mudir-sidebar-badge">{badge}</span>
                    <span className="truncate flex-1">{label}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="mudir-sidebar-section">
              <p className="mudir-sidebar-section-label">Data</p>
              <div className="space-y-0.5 px-1">
                <div className="mudir-sidebar-item">
                  <span className="mudir-sidebar-badge">C</span>
                  <span className="truncate flex-1">My students</span>
                </div>
              </div>
            </section>
          </nav>

          <div className="px-4 pb-2 pt-1 flex items-center justify-between">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
              Language
            </span>
            <div
              className="inline-flex items-center rounded-full border border-line bg-paper-cool p-0.5"
              dir="ltr"
            >
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium leading-none bg-ink text-paper-cool">
                EN
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium leading-none text-ink-soft">
                ع
              </span>
            </div>
          </div>

          <div className="mudir-sidebar-account">
            <span className="mudir-sidebar-account-avatar">SA</span>
            <div className="flex-1 min-w-0 text-start">
              <p className="text-sm font-medium leading-tight truncate text-ink">
                Sara Al-Mansoori
              </p>
              <p className="font-serif italic text-[11px] text-muted mt-0.5">
                Teacher
              </p>
            </div>
            <ChevronRight size={14} className="text-muted flex-shrink-0" />
          </div>
        </aside>

        {/* ── MAIN: PLANNER ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 h-full flex flex-col">
          <div className="relative flex-1 px-6 py-4 overflow-hidden bg-[#fbf2e6]">
            <div className="planner-view relative max-w-[1400px] mx-auto pb-0 h-full flex flex-col">
              <div className="mb-3">
                <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink leading-none tracking-tight">
                  May <em className="italic font-medium text-accent">2026</em>
                </h1>
                <p className="font-serif italic text-[13px] text-muted leading-snug mt-1.5">
                  Lesson plans, schedule, quizzes, homework, presentations, and activities — all on one grid.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-2 shrink-0">
                <span className="planner-nav-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] font-medium bg-ink text-paper-cool border-ink shadow-sm">
                  <span className="inline-flex h-3.5 w-3.5 rounded items-center justify-center text-[8px] bg-paper-cool/20">
                    ▦
                  </span>
                  All
                </span>
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const s = COLOR_STYLES[c.color];
                  return (
                    <span
                      key={c.key}
                      className={`planner-nav-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] ${s.chipBg} ${s.chipText} border-transparent`}
                    >
                      <Icon size={12} strokeWidth={1.75} />
                      {c.label}
                    </span>
                  );
                })}
                <span className="flex-1" />
                <span className="planner-nav-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/[0.10] text-accent text-[11.5px] font-semibold shadow-sm">
                  <Plus size={13} strokeWidth={2.5} />
                  Schedule
                </span>
                <span className="planner-nav-btn px-2.5 py-1 rounded-lg border border-line bg-paper-cool font-serif italic text-xs text-ink">
                  Today
                </span>
                <span className="planner-nav-btn h-7 w-7 rounded-lg border border-line bg-paper-cool flex items-center justify-center">
                  <ChevronLeft size={15} />
                </span>
                <span className="planner-nav-btn h-7 w-7 rounded-lg border border-line bg-paper-cool flex items-center justify-center">
                  <ChevronRight size={15} />
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] grid-rows-[auto_1fr] gap-x-6 gap-y-3 items-stretch flex-1 min-h-0">
                <div className="min-w-0">
                  <div className="planner-hero rounded-2xl p-4 md:p-5 relative overflow-hidden h-full flex flex-col justify-center">
                    <div className="relative z-10">
                      <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/[0.10] px-2.5 py-1 text-[11px] font-semibold text-accent mb-2.5">
                        <Sparkles size={11} strokeWidth={2.25} /> Studio AI
                      </p>
                      <h2 className="font-serif text-2xl md:text-[1.55rem] text-ink leading-[1.1] font-semibold tracking-tight">
                        What would you like to{" "}
                        <span className="italic font-medium text-accent">create</span>{" "}
                        today?
                      </h2>
                      <p className="text-[12.5px] text-muted mt-1.5 max-w-xl leading-snug">
                        Your AI co-pilot that helps you plan, save time, and make every class amazing.
                      </p>
                    </div>
                    <div className="relative z-10 mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      {heroChips.map((c) => {
                        const Icon = c.icon;
                        return (
                          <button
                            key={c.noun}
                            type="button"
                            onClick={onOpenStudio}
                            className="planner-hero-chip group"
                          >
                            <span
                              className={`planner-hero-chip-icon planner-hero-chip-icon-${c.color}`}
                            >
                              <Icon size={13} strokeWidth={2} />
                            </span>
                            <span className="flex flex-col min-w-0 text-start leading-[1.1]">
                              <span className="text-[10.5px] font-semibold text-ink whitespace-nowrap">
                                {c.verb}
                              </span>
                              <span className="text-[9px] text-muted whitespace-nowrap">
                                {c.noun}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="h-full flex flex-col rounded-2xl border border-[#e6dccb] bg-[#fffdf6] p-4 shadow-[0_18px_44px_-22px_rgba(15,20,16,0.14)]">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-serif text-[15px] font-medium text-ink leading-tight">
                        This Month Overview
                      </h3>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted mt-1 whitespace-nowrap">
                        MAY 2026
                      </span>
                    </div>
                    <div className="h-px bg-line/40 mb-3" />
                    <div className="grid grid-cols-3 gap-3">
                      {stats.map((s) => {
                        const Icon = s.icon;
                        return (
                          <div key={s.k}>
                            <span
                              className={`inline-flex h-6 w-6 rounded-md items-center justify-center ${s.iconBg} ${s.iconText} mb-2`}
                            >
                              <Icon size={12} strokeWidth={2.25} />
                            </span>
                            <p className="font-serif text-2xl font-medium text-ink leading-none">
                              {s.n}
                            </p>
                            <p className="text-[11px] text-muted mt-1.5">{s.k}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-auto pt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted">
                          Progress
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sage">
                          <TrendingUp size={11} strokeWidth={2.25} />
                          33%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-line/40 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sage to-sage/70"
                          style={{ width: "33%" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 min-h-0 flex flex-col">
                  <div className="planner-grid planner-card-frame rounded-2xl bg-paper-cool overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="grid grid-cols-7 border-b border-line bg-[#fffdf6] flex-shrink-0">
                      {weekdayLabels.map((d) => (
                        <div
                          key={d}
                          className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted px-2 py-1.5 text-center"
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    <div
                      className="grid grid-cols-7 flex-1 auto-rows-fr"
                      style={{ gridTemplateRows: `repeat(${grid.length / 7}, 1fr)` }}
                    >
                      {grid.map((d, i) => {
                        const inMonth = d.getMonth() === anchor.getMonth();
                        const isToday = sameYMD(d, today);
                        const isPast = !isToday && d < todayStart;
                        const dayEvents = (inMonth && EVENTS[iso(d)]) || [];
                        const shown = dayEvents.slice(0, 2);
                        const overflow = dayEvents.length - shown.length;
                        const lastRowStart = grid.length - 7;
                        return (
                          <div
                            key={i}
                            className={`planner-cell border-b border-r border-line/70 px-1.5 pt-1 pb-1 min-h-[60px] flex flex-col gap-0.5 ${
                              inMonth
                                ? isPast
                                  ? "bg-paper-cool/50"
                                  : "bg-paper-cool"
                                : "bg-paper-warm/40 text-muted/60"
                            } ${isToday ? "planner-cell-today" : ""} ${
                              (i + 1) % 7 === 0 ? "border-r-0" : ""
                            } ${i >= lastRowStart ? "border-b-0" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span
                                className={`font-mono text-[11px] leading-none ${
                                  isToday
                                    ? "h-6 w-6 rounded-full bg-accent text-paper-cool flex items-center justify-center font-medium text-[11.5px]"
                                    : inMonth
                                      ? isPast
                                        ? "text-muted/70"
                                        : "text-ink-soft"
                                      : "text-muted/60"
                                }`}
                              >
                                {d.getDate()}
                              </span>
                              {dayEvents.length > 0 && (
                                <span className="font-mono text-[10px] text-muted">
                                  {dayEvents.length}
                                </span>
                              )}
                            </div>
                            <div
                              className={`flex-1 flex flex-col gap-1 min-h-0 ${
                                isPast ? "opacity-60" : ""
                              }`}
                            >
                              {shown.map((e, ei) => {
                                const cat = CATEGORIES.find((c) => c.key === e.kind);
                                const s = COLOR_STYLES[cat?.color || "ink"];
                                return (
                                  <span
                                    key={ei}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${s.chipBg} ${s.chipText} text-[10.5px] leading-tight`}
                                  >
                                    <span
                                      className={`h-1 w-1 flex-shrink-0 rounded-full ${s.dot}`}
                                    />
                                    <span className="truncate">{e.title}</span>
                                  </span>
                                );
                              })}
                              {overflow > 0 && (
                                <span className="font-serif italic text-[10.5px] text-muted px-1.5">
                                  +{overflow} more
                                </span>
                              )}
                            </div>
                            {isToday && (
                              <span className="planner-cell-today-spark" aria-hidden>
                                <Sparkles size={11} strokeWidth={2} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 min-h-0 flex flex-col gap-3">
                  <div className="flex flex-col overflow-hidden flex-1 min-h-0">
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="font-serif text-[15px] font-medium text-ink">
                        Upcoming
                      </h3>
                      <span className="text-xs text-accent">View all</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {upcoming.map((e, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="flex-shrink-0 rounded-lg bg-paper-warm/60 px-2 py-1 text-center min-w-[44px]">
                            <div className="text-[9px] text-muted tracking-wider uppercase">
                              {e.m}
                            </div>
                            <div className="text-sm font-medium font-serif text-ink leading-none mt-0.5">
                              {e.d}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-medium text-ink leading-tight truncate">
                              {e.t}
                            </p>
                            <p className="text-[10.5px] text-muted mt-0.5">All day</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-serif text-[15px] font-medium text-ink mb-2.5">
                      Quick Actions
                    </h3>
                    <div className="flex flex-col gap-2">
                      {quickActions.map((a) => {
                        const Icon = a.icon;
                        return (
                          <button
                            key={a.label}
                            type="button"
                            onClick={onOpenStudio}
                            className="planner-nav-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-line/70 bg-paper-cool"
                          >
                            <span
                              className={`flex-shrink-0 inline-flex h-7 w-7 rounded-lg items-center justify-center ${toneToBg[a.tone]}`}
                            >
                              <Icon size={13} strokeWidth={2} />
                            </span>
                            <span className="flex-1 text-left text-[12.5px] font-medium text-ink">
                              {a.label}
                            </span>
                            <Plus size={13} strokeWidth={2} className="text-muted flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating callout — kept per request, restyled to the Studio palette */}
      <div
        className="absolute -bottom-8 -right-4 md:-right-12 rounded-2xl border border-line bg-paper-cool p-4 max-w-[240px] hidden md:block"
        style={{ boxShadow: "0 20px 50px -10px rgba(26,24,20,0.18)" }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
          Saved this week
        </div>
        <div className="font-serif text-3xl font-semibold text-accent mb-1">
          11h 40m
        </div>
        <div className="font-serif italic text-xs text-muted">
          Average across UAE pilot teachers
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// PROBLEM SECTION — empathy
// =====================================================================
const Problem = () => {
  const items = [
    "Three apps for one lesson plan.",
    "Worksheets reformatted Sunday night.",
    "Quizzes rewritten from last year.",
    "Attendance, grades, and parents in different tabs.",
    "Endless copy-paste between PDFs.",
    "Sunday dread.",
  ];

  return (
    <section className="py-24 md:py-36" style={{ borderColor: "var(--line)" }}>
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-4">
            <Reveal>
              <div className="eyebrow mb-6">The honest part</div>
              <h2 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight">
                Teaching already
                <br />
                demands enough
                <br />
                <em style={{ color: "var(--clay)" }}>energy.</em>
              </h2>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-7 md:col-start-6">
            <Reveal delay={1}>
              <p
                className="text-xl md:text-2xl font-display leading-relaxed mb-12"
                style={{ color: "var(--ink-2)" }}
              >
                You did not become a teacher to spend Sunday evening fighting
                with Word documents. The job is hard enough without the system
                adding friction to every hour.
              </p>
            </Reveal>
            <div className="space-y-0">
              {items.map((item, i) => (
                <Reveal key={i} delay={i + 2}>
                  <div
                    className="flex items-center gap-6 py-5 border-t"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span
                      className="font-mono text-xs w-6"
                      style={{ color: "var(--ink-3)" }}
                    >
                      0{i + 1}
                    </span>
                    <span className="text-lg md:text-xl">{item}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// WORKFLOW — How it works
// =====================================================================
const Workflow = () => {
  const steps = [
    {
      n: "01",
      label: "Direct",
      title: "Tell Mudir what you're teaching.",
      body: "A topic, a grade, a class. A photo of the textbook page. A scribbled outline. Mudir reads context the way a colleague would.",
      tag: "30 seconds",
    },
    {
      n: "02",
      label: "Draft",
      title: "Mudir prepares everything.",
      body: "A lesson plan with timing. A starter activity. Three differentiated worksheets. A formative quiz. Slides if you want them. Aligned to MoE outcomes.",
      tag: "Under a minute",
    },
    {
      n: "03",
      label: "Deliver",
      title: "You review, refine, and teach.",
      body: "Edit anything. Approve in one click. Export to PDF, Word, or print. Send homework to parents. Track who completed what.",
      tag: "You stay in charge",
    },
  ];

  return (
    <section
      id="workflow"
      className="py-24 md:py-36"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="max-w-2xl mb-24">
          <Reveal>
            <div className="eyebrow mb-6">How it works</div>
            <h2 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight mb-6">
              One workspace.
              <br />
              Three calm steps.
            </h2>
            <p
              className="text-xl leading-relaxed"
              style={{ color: "var(--ink-2)" }}
            >
              Mudir is not a chatbot you have to fight with. It's a structured
              flow from intent to ready-to-teach material.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-12 gap-8 md:gap-12">
          {steps.map((s, i) => (
            <Reveal key={i} delay={i} className="col-span-12 md:col-span-4">
              <div className="relative h-full">
                {i < 2 && (
                  <div
                    className="hidden md:block absolute top-3 -right-6 w-12 h-px"
                    style={{ background: "var(--line-strong)" }}
                  >
                    <div
                      className="absolute right-0 -top-1 w-2 h-2 border-t border-r rotate-45"
                      style={{ borderColor: "var(--line-strong)" }}
                    />
                  </div>
                )}

                <div className="flex items-baseline gap-3 mb-6">
                  <span
                    className="font-mono text-xs"
                    style={{ color: "var(--clay)" }}
                  >
                    {s.n}
                  </span>
                  <span className="eyebrow">{s.label}</span>
                </div>
                <h3 className="font-display text-2xl md:text-[28px] leading-tight mb-4">
                  {s.title}
                </h3>
                <p
                  className="leading-relaxed mb-6"
                  style={{ color: "var(--ink-2)" }}
                >
                  {s.body}
                </p>
                <div
                  className="inline-flex items-center gap-2 text-xs font-mono px-2.5 py-1 rounded"
                  style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}
                >
                  <div
                    className="w-1 h-1 rounded-full"
                    style={{ background: "var(--sage)" }}
                  />
                  {s.tag}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// PRODUCT SHOWCASE — tabbed UI
// =====================================================================
const MockShell = ({ children, label }) => (
  <div
    className="card overflow-hidden"
    style={{ boxShadow: "0 20px 60px -20px rgba(42,31,23,0.12)" }}
  >
    <div
      className="flex items-center gap-2 px-4 py-3 border-b"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="dot" style={{ background: "var(--paper-3)" }} />
      <div className="dot" style={{ background: "var(--paper-3)" }} />
      <div className="dot" style={{ background: "var(--paper-3)" }} />
      <div
        className="flex-1 text-center text-[11px] font-mono"
        style={{ color: "var(--ink-3)" }}
      >
        {label}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const LessonPlanMock = () => (
  <MockShell label="lessons / photosynthesis · 7A">
    <div className="eyebrow mb-2">Sunday 17 May · 50 min</div>
    <h4 className="font-display text-2xl mb-4">
      Photosynthesis — leaf structure
    </h4>
    <div className="grid grid-cols-12 gap-3 mb-4">
      {[
        ["00–05", 'Starter · "What did your plant need this week?"'],
        ["05–15", "Recap chloroplasts · diagram on board"],
        ["15–35", "Worksheet · differentiated 3 levels"],
        ["35–45", "Pair discussion · sunlight vs water"],
        ["45–50", "Exit ticket · 3 questions"],
      ].map(([tm, d], i, arr) => (
        <React.Fragment key={tm}>
          <div
            className="col-span-3 text-xs font-mono py-2"
            style={{ color: "var(--ink-3)" }}
          >
            {tm}
          </div>
          <div
            className={`col-span-9 text-sm py-2 ${
              i < arr.length - 1 ? "border-b" : ""
            }`}
            style={{ borderColor: "var(--line)" }}
          >
            {d}
          </div>
        </React.Fragment>
      ))}
    </div>
    <div className="flex items-center gap-2 text-xs">
      <span
        className="px-2 py-0.5 rounded font-mono"
        style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}
      >
        MoE 7.2.1
      </span>
      <span
        className="px-2 py-0.5 rounded font-mono"
        style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}
      >
        Bloom · understand → apply
      </span>
    </div>
  </MockShell>
);

const QuizMock = () => (
  <MockShell label="quiz / cell respiration · 7B">
    <div className="eyebrow mb-2">Formative · 10 questions · 15 min</div>
    <h4 className="font-display text-2xl mb-5">Cell respiration · check</h4>
    <div className="space-y-3">
      {[
        { n: "1", q: "Which organelle produces most ATP?", type: "MCQ" },
        { n: "2", q: "Word equation for aerobic respiration.", type: "Short" },
        {
          n: "3",
          q: "Why do muscle cells switch to anaerobic?",
          type: "Extended",
        },
      ].map((i) => (
        <div
          key={i.n}
          className="card p-3 flex items-start gap-3"
          style={{ background: "var(--paper-2)" }}
        >
          <span className="font-mono text-xs" style={{ color: "var(--ink-3)" }}>
            {i.n}
          </span>
          <div className="flex-1">
            <div className="text-sm mb-1">{i.q}</div>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "var(--paper)", color: "var(--ink-3)" }}
            >
              {i.type}
            </span>
          </div>
        </div>
      ))}
      <div
        className="text-xs text-center pt-1"
        style={{ color: "var(--ink-3)" }}
      >
        + 7 more · auto-graded
      </div>
    </div>
  </MockShell>
);

const RosterMock = () => (
  <MockShell label="students / 7A">
    <div className="flex items-baseline justify-between mb-4">
      <h4 className="font-display text-2xl">Class 7A</h4>
      <span className="text-xs font-mono" style={{ color: "var(--ink-3)" }}>
        28 students
      </span>
    </div>
    <div className="space-y-2">
      {[
        { n: "Aisha A.", g: "92%", a: "Present", c: "var(--sage)" },
        { n: "Bilal H.", g: "78%", a: "Present", c: "var(--sage)" },
        { n: "Fatima R.", g: "85%", a: "Late", c: "var(--clay)" },
        { n: "Hamad K.", g: "67%", a: "Absent · note", c: "#9B8B76" },
        { n: "Layla S.", g: "94%", a: "Present", c: "var(--sage)" },
      ].map((s) => (
        <div
          key={s.n}
          className="flex items-center gap-4 py-2.5 border-b"
          style={{ borderColor: "var(--line)" }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium"
            style={{ background: "var(--paper-2)" }}
          >
            {s.n
              .split(" ")
              .map((x) => x[0])
              .join("")}
          </div>
          <div className="flex-1 text-sm">{s.n}</div>
          <div
            className="text-xs font-mono"
            style={{ color: "var(--ink-2)" }}
          >
            {s.g}
          </div>
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "var(--ink-2)" }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: s.c }}
            />
            {s.a}
          </div>
        </div>
      ))}
      <div
        className="text-xs text-center pt-2"
        style={{ color: "var(--ink-3)" }}
      >
        + 23 more
      </div>
    </div>
  </MockShell>
);

const DashboardMock = () => (
  <MockShell label="today · sunday 17 may">
    <div className="grid grid-cols-3 gap-3 mb-5">
      {[
        { l: "Lessons", v: "3" },
        { l: "Drafts to review", v: "2" },
        { l: "Parent replies", v: "1" },
      ].map((x) => (
        <div
          key={x.l}
          className="card p-3"
          style={{ background: "var(--paper-2)" }}
        >
          <div className="eyebrow mb-1">{x.l}</div>
          <div className="font-display text-3xl">{x.v}</div>
        </div>
      ))}
    </div>
    <div className="eyebrow mb-3">Upcoming this week</div>
    <div className="space-y-2">
      {[
        "Photosynthesis quiz · Tuesday",
        "Parent conference · Wednesday",
        "Mid-term planning · Thursday",
      ].map((x) => (
        <div
          key={x}
          className="flex items-center gap-3 text-sm py-2 border-t"
          style={{ borderColor: "var(--line)" }}
        >
          <div
            className="w-1 h-1 rounded-full"
            style={{ background: "var(--clay)" }}
          />
          {x}
        </div>
      ))}
    </div>
  </MockShell>
);

const ProductShowcase = () => {
  const [active, setActive] = useState(0);

  const tabs = [
    {
      label: "Lesson plan",
      eyebrow: "Lesson plans",
      title: "Plans that already know your curriculum.",
      body: "MoE-aligned by default. Adjusts to your pace, your class size, your teaching style. Re-uses what worked last term.",
      mock: <LessonPlanMock />,
    },
    {
      label: "Quiz",
      eyebrow: "Quizzes & exams",
      title: "Quizzes drafted in the time it takes to make tea.",
      body: "Mixed formats. Bloom-tagged. Differentiated automatically for stronger and weaker students. Auto-graded.",
      mock: <QuizMock />,
    },
    {
      label: "Roster",
      eyebrow: "Student database",
      title: "Every student, every guardian, in one quiet place.",
      body: "Attendance, grades, contact info, notes — connected. No spreadsheets. No silos. Search across everything.",
      mock: <RosterMock />,
    },
    {
      label: "Today",
      eyebrow: "Daily dashboard",
      title: "Your day, on one screen.",
      body: "Three lessons, two drafts to review, one parent reply. Mudir surfaces what matters before you open anything.",
      mock: <DashboardMock />,
    },
  ];

  return (
    <section
      id="features"
      className="py-24 md:py-36"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="max-w-2xl mb-16">
          <Reveal>
            <div className="eyebrow mb-6">Inside the product</div>
            <h2 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight">
              Everything a teacher prepares.
              <br />
              <em style={{ color: "var(--clay)" }}>Drafted for you.</em>
            </h2>
          </Reveal>
        </div>

        <Reveal>
          <div
            className="flex flex-wrap gap-2 mb-10 pb-6 border-b"
            style={{ borderColor: "var(--line)" }}
          >
            {tabs.map((tb, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  active === i ? "" : "hover:opacity-80"
                }`}
                style={{
                  background: active === i ? "var(--ink)" : "transparent",
                  color: active === i ? "var(--paper)" : "var(--ink-2)",
                  border: active === i ? "none" : "0.5px solid var(--line-strong)",
                }}
              >
                {tb.label}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="grid grid-cols-12 gap-8 md:gap-16 items-start">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="col-span-12 md:col-span-5"
            >
              <div className="eyebrow mb-4">{tabs[active].eyebrow}</div>
              <h3 className="font-display text-3xl md:text-4xl leading-tight mb-5">
                {tabs[active].title}
              </h3>
              <p
                className="text-lg leading-relaxed"
                style={{ color: "var(--ink-2)" }}
              >
                {tabs[active].body}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="col-span-12 md:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                {tabs[active].mock}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// AI STUDIO
// =====================================================================
const StudioMock = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 4), 2400);
    return () => clearInterval(t);
  }, []);

  const stages = [
    { l: "Listening", c: "var(--clay)" },
    { l: "Outlining", c: "var(--clay)" },
    { l: "Drafting", c: "var(--clay)" },
    { l: "Ready", c: "var(--sage)" },
  ];

  return (
    <div
      className="card p-6"
      style={{
        background: "var(--paper)",
        boxShadow: "0 30px 80px -20px rgba(42,31,23,0.16)",
      }}
    >
      <div
        className="card p-4 mb-4"
        style={{ background: "var(--paper-2)" }}
      >
        <div className="eyebrow mb-2">You said</div>
        <div className="text-sm leading-relaxed">
          Worksheet on photosynthesis for Grade 7. Three difficulty levels.
          Include one diagram-label question. MoE-aligned.
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {stages.map((s, i) => (
          <React.Fragment key={i}>
            <motion.div
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono"
              animate={{
                background: i === step ? "var(--paper-2)" : "transparent",
                color: i <= step ? "var(--ink)" : "var(--ink-3)",
              }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                animate={{ background: i <= step ? s.c : "var(--paper-3)" }}
              />
              {s.l}
            </motion.div>
            {i < stages.length - 1 && (
              <div
                className="w-3 h-px"
                style={{ background: "var(--line)" }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div>
        <div className="eyebrow mb-3">Mudir drafted</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { l: "Level 1", desc: "Foundation", n: "8 questions" },
            { l: "Level 2", desc: "Core", n: "10 questions" },
            { l: "Level 3", desc: "Extension", n: "12 questions" },
          ].map((x, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: step >= 3 ? 1 : 0.3, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: EASE }}
              className="card p-3"
              style={{ background: "var(--paper-2)" }}
            >
              <div className="eyebrow mb-1.5">{x.l}</div>
              <div className="text-sm font-medium mb-0.5">{x.desc}</div>
              <div className="text-xs" style={{ color: "var(--ink-3)" }}>
                {x.n}
              </div>
            </motion.div>
          ))}
        </div>

        <div
          className="mt-4 pt-4 border-t flex items-center justify-between"
          style={{ borderColor: "var(--line)" }}
        >
          <span
            className="text-xs font-mono"
            style={{ color: "var(--ink-3)" }}
          >
            worksheet · 3 PDFs · answer keys
          </span>
          <button
            className="text-xs px-3 py-1.5 rounded-md font-medium"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
};

const Studio = () => {
  return (
    <section
      id="studio"
      className="py-24 md:py-36"
      style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
    >
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="grid grid-cols-12 gap-8 md:gap-16 items-center">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <div className="eyebrow mb-6">AI content studio</div>
              <h2 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight mb-6">
                Worksheets,
                <br />
                slides, activities —
                <br />
                <em style={{ color: "var(--clay)" }}>on demand.</em>
              </h2>
              <p
                className="text-lg leading-relaxed mb-8"
                style={{ color: "var(--ink-2)" }}
              >
                The Studio is where Mudir generates the things you'd otherwise
                spend two hours making yourself. You describe. It drafts. You
                refine.
              </p>
              <ul className="space-y-3 text-sm">
                {[
                  "Worksheets, 3 difficulty levels",
                  "Slide decks with speaker notes",
                  "Classroom activities & group work",
                  "Homework + answer keys",
                  "Printable PDFs, every time",
                ].map((x) => (
                  <li key={x} className="flex items-center gap-3">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M3 7l3 3 5-6"
                        stroke="var(--clay)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {x}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <div className="col-span-12 md:col-span-7">
            <Reveal delay={1}>
              <StudioMock />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// DAY IN THE LIFE
// =====================================================================
const DayInLife = () => {
  const moments = [
    {
      time: "6:45 AM",
      label: "Before school",
      line: "Mudir has drafted today's three lessons. You skim them on the drive in.",
    },
    {
      time: "8:00 AM",
      label: "Period one",
      line: "Open the lesson. The worksheet is already printed. Begin.",
    },
    {
      time: "10:30 AM",
      label: "Break",
      line: "A parent replied. Mudir suggests a response. You add one sentence and send.",
    },
    {
      time: "1:00 PM",
      label: "Lunch",
      line: "Tomorrow's quiz needs review. Three taps. Approved.",
    },
    {
      time: "3:30 PM",
      label: "Final bell",
      line: "Attendance and grades synced. Your evening is yours.",
    },
  ];

  return (
    <section className="py-24 md:py-36" style={{ borderColor: "var(--line)" }}>
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="max-w-2xl mb-20">
          <Reveal>
            <div className="eyebrow mb-6">A day with Mudir</div>
            <h2 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight">
              From Sunday dread
              <br />
              to <em style={{ color: "var(--clay)" }}>Sunday calm.</em>
            </h2>
          </Reveal>
        </div>

        <div className="relative max-w-3xl">
          <div
            className="absolute left-[80px] top-2 bottom-2 w-px"
            style={{ background: "var(--line)" }}
          />

          <div className="space-y-12">
            {moments.map((m, i) => (
              <Reveal key={i} delay={i}>
                <div className="flex gap-8 items-start">
                  <div className="w-[72px] flex-shrink-0 pt-0.5">
                    <div
                      className="font-mono text-xs mb-1"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {m.time}
                    </div>
                  </div>
                  <div className="relative">
                    <div
                      className="absolute -left-[26px] top-2 w-2.5 h-2.5 rounded-full border-2"
                      style={{
                        background: "var(--paper)",
                        borderColor: "var(--clay)",
                      }}
                    />
                    <div className="eyebrow mb-2">{m.label}</div>
                    <p className="font-display text-xl md:text-2xl leading-snug">
                      {m.line}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// FEATURE GRID
// =====================================================================
const FeatureGrid = () => {
  const features = [
    { label: "Lesson plans", desc: "MoE-aligned. Differentiated. Reusable." },
    { label: "Quizzes & exams", desc: "Mixed formats. Auto-graded. Bloom-tagged." },
    { label: "Homework", desc: "Sent to students or parents. Tracked." },
    { label: "Worksheets", desc: "Three levels. Printable. Editable." },
    { label: "Slides", desc: "Generated with speaker notes." },
    { label: "Activities", desc: "Group work, starters, exit tickets." },
    { label: "Attendance", desc: "One screen. Optional auto-marking." },
    { label: "Grades", desc: "Synced to your gradebook." },
    { label: "Guardians", desc: "Direct messages. No new apps to install." },
    { label: "Schedule", desc: "Term, week, day — at the right zoom." },
    { label: "Daily dashboard", desc: "What needs you today, in priority order." },
    { label: "AI studio", desc: "Anything else, drafted on demand." },
  ];

  return (
    <section
      className="py-24 md:py-36"
      style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
    >
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="max-w-2xl mb-16">
          <Reveal>
            <div className="eyebrow mb-6">Everything in one place</div>
            <h2 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight">
              Built for the
              <br />
              whole teaching week.
            </h2>
          </Reveal>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-px"
          style={{ background: "var(--line)" }}
        >
          {features.map((f, i) => (
            <Reveal key={i} delay={i % 3}>
              <div
                className="p-8 h-full lift"
                style={{ background: "var(--paper-2)" }}
              >
                <div className="font-display text-2xl mb-2">{f.label}</div>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--ink-2)" }}
                >
                  {f.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// PHILOSOPHY
// =====================================================================
const Philosophy = () => {
  const principles = [
    {
      n: "I",
      title: "The teacher is the author.",
      body: "Mudir drafts. You direct. Every output is a starting point, never the final word.",
    },
    {
      n: "II",
      title: "Calm over clever.",
      body: "We chose restraint over novelty. No flashing prompts. No surprises. Just structure.",
    },
    {
      n: "III",
      title: "Aligned to the UAE classroom.",
      body: "MoE outcomes, Arabic-first content where relevant, local context understood.",
    },
    {
      n: "IV",
      title: "Private by default.",
      body: "Student data stays in your school's region. Nothing trains a public model.",
    },
  ];

  return (
    <section
      id="philosophy"
      className="py-24 md:py-36"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="grid grid-cols-12 gap-8 mb-20">
          <div className="col-span-12 md:col-span-4">
            <Reveal>
              <div className="eyebrow mb-6">What we believe</div>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-8">
            <Reveal delay={1}>
              <h2 className="font-display text-5xl md:text-7xl leading-[1.02] tracking-tight">
                AI should reduce
                <br />
                teacher workload —
                <br />
                <em style={{ color: "var(--clay)" }}>not replace</em>
                <br />
                teacher judgment.
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 md:gap-12 mt-24">
          {principles.map((p, i) => (
            <Reveal key={i} delay={i} className="col-span-12 md:col-span-6">
              <div
                className="flex gap-6 pb-8 border-b"
                style={{ borderColor: "var(--line)" }}
              >
                <span
                  className="font-display text-3xl flex-shrink-0"
                  style={{ color: "var(--clay)" }}
                >
                  {p.n}
                </span>
                <div>
                  <h3 className="font-display text-2xl mb-3 leading-tight">
                    {p.title}
                  </h3>
                  <p
                    className="leading-relaxed"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {p.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// VOICES
// =====================================================================
const Voices = () => {
  const quotes = [
    {
      q: "I used to spend three hours every Sunday preparing the week. Now it takes thirty minutes — and I'm reviewing, not writing from scratch.",
      n: "Sara Al-Hashimi",
      r: "Grade 7 science · GEMS, Dubai",
    },
    {
      q: "Mudir doesn't try to be clever. It just gets the worksheet on my desk before I've finished my coffee.",
      n: "Karim Nasr",
      r: "Grade 10 mathematics · Aldar, Abu Dhabi",
    },
    {
      q: "I was sceptical of AI in education. After a term using Mudir, I'm less tired, my lessons are tighter, and my evenings are mine again.",
      n: "Nadia Othman",
      r: "Head of English · Taaleem",
    },
  ];

  return (
    <section className="py-24 md:py-36" style={{ borderColor: "var(--line)" }}>
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="max-w-2xl mb-16">
          <Reveal>
            <div className="eyebrow mb-6">From the pilot</div>
            <h2 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight">
              Teachers, in
              <br />
              their words.
            </h2>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quotes.map((q, i) => (
            <Reveal key={i} delay={i}>
              <figure className="card p-8 h-full flex flex-col">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 22 22"
                  fill="none"
                  className="mb-6"
                >
                  <path
                    d="M3 14V10c0-3 2-5 5-5M11 14v-4c0-3 2-5 5-5"
                    stroke="var(--clay)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <blockquote className="font-display text-xl leading-snug mb-6 flex-1">
                  {q.q}
                </blockquote>
                <figcaption>
                  <div className="text-sm font-medium">{q.n}</div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {q.r}
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// FINAL CTA
// =====================================================================
const CTA = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section
      id="cta"
      className="py-24 md:py-36 relative overflow-hidden"
      style={{ borderColor: "var(--line)", background: "var(--ink)" }}
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(181,117,78,0.4) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      <div className="relative max-w-[1280px] mx-auto px-8">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <div
              className="eyebrow mb-8"
              style={{ color: "rgba(247,243,236,0.5)" }}
            >
              Now in pilot — UAE schools
            </div>
            <h2
              className="font-display text-6xl md:text-8xl leading-[0.98] tracking-tight mb-8"
              style={{ color: "var(--paper)" }}
            >
              Get your
              <br />
              evenings back.
            </h2>
            <p
              className="text-xl mb-12 max-w-xl mx-auto leading-relaxed"
              style={{ color: "rgba(247,243,236,0.65)" }}
            >
              Join the waitlist. We're opening access to teachers and schools
              gradually, with care, starting this term.
            </p>
          </Reveal>

          <Reveal delay={1}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@school.ae"
                className="flex-1 px-5 py-3.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: "rgba(247,243,236,0.06)",
                  color: "var(--paper)",
                  border: "0.5px solid rgba(247,243,236,0.18)",
                }}
              />
              <button
                type="submit"
                className="px-6 py-3.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "var(--clay)", color: "var(--paper)" }}
              >
                {submitted ? "Thank you ✓" : "Join waitlist"}
              </button>
            </form>
          </Reveal>

          <Reveal delay={2}>
            <p
              className="mt-10 text-xs"
              style={{ color: "rgba(247,243,236,0.4)" }}
            >
              No marketing emails. We'll write once, when it's your turn.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// FOOTER
// =====================================================================
const Footer = ({ onOpenStudio }) => (
  <footer
    className="py-16"
    style={{ borderColor: "var(--line)", background: "var(--paper)" }}
  >
    <div className="max-w-[1280px] mx-auto px-8">
      <div className="grid grid-cols-12 gap-8 mb-16">
        <div className="col-span-12 md:col-span-5">
          <div className="flex items-center gap-2.5 mb-5">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "var(--ink)" }}
            >
              <span
                className="font-display text-base"
                style={{ color: "var(--paper)" }}
              >
                م
              </span>
            </div>
            <span className="font-display text-xl">Mudir</span>
          </div>
          <p className="font-display text-2xl leading-tight max-w-sm mb-6">
            A calmer way to prepare lessons.
          </p>
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            Built in Dubai, for teachers across the UAE.
          </p>
        </div>

        <div className="col-span-6 md:col-span-2">
          <div className="eyebrow mb-4">Product</div>
          <ul className="space-y-2.5 text-sm" style={{ color: "var(--ink-2)" }}>
            <li>
              <a href="#features" className="link-quiet">
                Features
              </a>
            </li>
            <li>
              <a href="#workflow" className="link-quiet">
                How it works
              </a>
            </li>
            <li>
              <a href="#studio" className="link-quiet">
                AI studio
              </a>
            </li>
            <li>
              <a href="#" className="link-quiet">
                Pricing
              </a>
            </li>
          </ul>
        </div>

        <div className="col-span-6 md:col-span-2">
          <div className="eyebrow mb-4">Schools</div>
          <ul className="space-y-2.5 text-sm" style={{ color: "var(--ink-2)" }}>
            <li>
              <a href="#" className="link-quiet">
                For schools
              </a>
            </li>
            <li>
              <a href="#" className="link-quiet">
                MoE alignment
              </a>
            </li>
            <li>
              <a href="#" className="link-quiet">
                Data privacy
              </a>
            </li>
            <li>
              <a href="#" className="link-quiet">
                Contact
              </a>
            </li>
          </ul>
        </div>

        <div className="col-span-12 md:col-span-3">
          <div className="eyebrow mb-4">From the team</div>
          <p
            className="text-sm leading-relaxed mb-4"
            style={{ color: "var(--ink-2)" }}
          >
            We're a small team building Mudir alongside teachers in Dubai and
            Abu Dhabi. Updates come once a month.
          </p>
          <button
            type="button"
            onClick={onOpenStudio}
            className="text-sm link-quiet font-medium"
          >
            Open the planner →
          </button>
        </div>
      </div>

      <div
        className="pt-8 border-t flex flex-wrap items-center justify-between gap-4 text-xs"
        style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}
      >
        <div>© 2026 Mudir. Made in Dubai.</div>
        <div className="flex items-center gap-6">
          <a href="#" className="link-quiet">
            Privacy
          </a>
          <a href="#" className="link-quiet">
            Terms
          </a>
          <a href="#" className="link-quiet">
            Security
          </a>
        </div>
      </div>
    </div>
  </footer>
);

// =====================================================================
// LANDING (exported)
// =====================================================================
export default function Landing({ onOpenStudio }) {
  return (
    <div className="mudir-landing paper-noise">
      <Nav onOpenStudio={onOpenStudio} />
      <Hero onOpenStudio={onOpenStudio} />
      <SectionDivider variant="wave" />
      <Problem />
      <SectionDivider variant="calm" />
      <Workflow />
      <SectionDivider variant="cascade" />
      <ProductShowcase />
      <SectionDivider variant="rise" />
      <Studio />
      <SectionDivider variant="calm" flip />
      <DayInLife />
      <SectionDivider variant="wave" />
      <FeatureGrid />
      <SectionDivider variant="cascade" flip />
      <Philosophy />
      <SectionDivider variant="rise" />
      <Voices />
      <CTA />
      <Footer onOpenStudio={onOpenStudio} />
    </div>
  );
}
