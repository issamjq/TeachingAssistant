import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles, ArrowRight, ChevronRight, ChevronLeft, Plus, BookOpen,
  CalendarDays, GraduationCap, ClipboardList, Presentation, Layout,
  Users, MessageCircle, CheckCircle2, Clock, TrendingUp, FileText,
  BarChart3, Pencil, Trash2, ArrowUpDown, Calendar, LayoutGrid, List,
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
// TEACHER SHOWCASE — interactive desktop feature explorer
// Two flanking columns of feature pills + a centre app preview that
// swaps to match the selected feature (Apploye-style, Mudir palette).
// =====================================================================
const EB = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted";

function Win({ title, children }) {
  return (
    <div className="mudir-studio-frame rounded-2xl overflow-hidden border border-line bg-paper-cool shadow-[0_40px_90px_-30px_rgba(26,24,20,0.32)]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-[#fffdf6]">
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <div className="flex-1 text-center text-[11px] text-muted font-medium">
          {title}
        </div>
      </div>
      <div className="h-[460px] overflow-hidden bg-[#fbf2e6] text-ink px-6 pt-5">
        {children}
      </div>
    </div>
  );
}

// Faithful replica of the Studio's shared DataPageHeader (eyebrow +
// serif title with red italic accent + caption + toolbar chips).
function Head({ eyebrow, plain, em, sub, neu }) {
  return (
    <div className="mb-5">
      <div className="mb-3.5">
        <p className={`${EB} mb-2 inline-flex items-center gap-2.5`}>
          <span className="w-6 h-px bg-accent" /> {eyebrow}
        </p>
        <h2 className="font-serif text-[28px] font-medium text-ink leading-tight">
          {plain}
          <em className="italic font-light text-accent">{em}</em>
        </h2>
        <p className="text-muted text-[12.5px] mt-1.5 max-w-2xl">{sub}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[11.5px] border border-line bg-paper-cool text-ink">
          <ArrowUpDown size={11} className="text-muted" /> Newest
        </span>
        <span className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[11.5px] border border-line bg-paper-cool text-ink">
          <Calendar size={11} className="text-muted" /> All time
        </span>
        <span className="h-8 inline-flex items-center gap-1 px-1 rounded-lg border border-line bg-paper-cool">
          <span className="h-6 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[11.5px] bg-ink text-paper-cool">
            <LayoutGrid size={11} /> Cards
          </span>
          <span className="h-6 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[11.5px] text-ink">
            <List size={11} /> List
          </span>
        </span>
        <span className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[11.5px] border border-line bg-paper-cool text-ink">
          <Trash2 size={11} /> Recently deleted
        </span>
        <span className="h-8 ml-auto inline-flex items-center gap-1.5 px-3 rounded-lg text-[11.5px] bg-ink text-paper-cool font-medium border border-ink">
          <Plus size={12} strokeWidth={2.25} /> {neu}
        </span>
      </div>
    </div>
  );
}

function Cnt({ children }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-3.5">
      {children}
    </p>
  );
}

function DGrid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">{children}</div>;
}

// Replica of the Studio's DataCard (status chip, serif title, mono
// meta, dashed-top stat row, pencil + trash in the corner).
function DCard({ status, title, meta, stats }) {
  return (
    <div className="relative rounded-2xl border border-[#e6dccb] bg-paper-cool shadow-[0_18px_44px_-22px_rgba(15,20,16,0.14)] p-4 flex flex-col">
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <span className="h-6 w-6 rounded-md border border-line bg-paper-cool flex items-center justify-center">
          <Pencil size={11} className="text-ink-soft" />
        </span>
        <span className="h-6 w-6 rounded-md border border-line bg-paper-cool flex items-center justify-center text-ink-soft">
          <Trash2 size={11} />
        </span>
      </div>
      <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded self-start">
        {status}
      </span>
      <h3 className="font-serif text-[15px] font-medium text-ink leading-snug mt-2 pr-14">
        {title}
      </h3>
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted mt-1">
        {meta}
      </p>
      <div
        className="grid gap-2 mt-2.5 pt-2.5 border-t border-dashed border-line"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))` }}
      >
        {stats.map(([l, v]) => (
          <div key={l} className="min-w-0">
            <p className="font-mono text-[8.5px] uppercase tracking-wider text-muted">
              {l}
            </p>
            <p className="text-[11.5px] text-ink mt-0.5 leading-tight truncate">
              {v}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Lesson Plans — tab bar (Templates library / Drafts) + template
//    cards, mirroring the real /lesson-plans screen.
function PvLesson() {
  const tpl = [
    { status: "Template", title: "Inquiry-led science lesson", meta: "Science · KG–G6", stats: [["Stages", "4"], ["Duration", "50 min"], ["Used", "23×"]] },
    { status: "Template", title: "Exam revision carousel", meta: "Any · G7–G12", stats: [["Stages", "5"], ["Duration", "45 min"], ["Used", "61×"]] },
    { status: "Template", title: "Lab practical write-up", meta: "Science · G7–G12", stats: [["Stages", "3"], ["Duration", "60 min"], ["Used", "12×"]] },
    { status: "Template", title: "Reading circle", meta: "English · G3–G9", stats: [["Stages", "4"], ["Duration", "40 min"], ["Used", "38×"]] },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line mb-5">
        <span className="px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] border-b-2 border-accent text-ink">
          Templates library
        </span>
        <span className="px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] border-b-2 border-transparent text-muted">
          Drafts
        </span>
      </div>
      <Head
        eyebrow="Templates"
        plain="Templates "
        em="library"
        sub="Pick a starting point. Edit it once, reuse it forever."
        neu="New template"
      />
      <Cnt>4 templates</Cnt>
      <DGrid>
        {tpl.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvQuiz() {
  const items = [
    { status: "Scheduled", title: "Cell respiration · check", meta: "Science · G7 · 7B", stats: [["Marks", "20"], ["Duration", "15 min"], ["Scheduled", "May 19"]] },
    { status: "Draft", title: "Photosynthesis end-of-unit", meta: "Science · G7 · 7A", stats: [["Marks", "40"], ["Duration", "45 min"], ["Scheduled", "—"]] },
    { status: "Graded", title: "Genetics mid-term", meta: "Science · G10 · 10D", stats: [["Marks", "60"], ["Duration", "60 min"], ["Scheduled", "May 8"]] },
    { status: "Scheduled", title: "States of matter quiz", meta: "Science · G8 · 8B", stats: [["Marks", "15"], ["Duration", "12 min"], ["Scheduled", "May 22"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Quizzes & exams"
        plain="Quizzes & "
        em="exams"
        sub="Build, schedule, and grade. MCQ, true/false, short, and essay."
        neu="New quiz"
      />
      <Cnt>4 quizzes &amp; exams</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvHomework() {
  const items = [
    { status: "Open", title: "Worksheet 4 — leaf structure", meta: "Science · G7 · 7A", stats: [["Due", "May 21"], ["Section", "7A"]] },
    { status: "Graded", title: "Balancing equations set", meta: "Science · G9 · 9C", stats: [["Due", "May 12"], ["Section", "9C"]] },
    { status: "Open", title: "Reading log — chapters 4–6", meta: "English · G5 · 5B", stats: [["Due", "May 24"], ["Section", "5B"]] },
    { status: "Open", title: "Practice problems · fractions", meta: "Maths · G5 · 5B", stats: [["Due", "May 20"], ["Section", "5B"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Homework"
        plain=""
        em="Homework"
        sub="Assign work to a class, track who's done it, grade and give feedback."
        neu="New homework"
      />
      <Cnt>4 homework tasks</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvPresentation() {
  const items = [
    { status: "Ready", title: "Photosynthesis — how leaves work", meta: "Science · G7 · 7A", stats: [["Slides", "12"], ["Linked", "Lesson 4"]] },
    { status: "Draft", title: "Cell respiration overview", meta: "Science · G7 · 7B", stats: [["Slides", "9"], ["Linked", "—"]] },
    { status: "Ready", title: "Romeo & Juliet — Act 1", meta: "English · G10 · 10D", stats: [["Slides", "16"], ["Linked", "Lesson 2"]] },
    { status: "Ready", title: "Intro to statistics", meta: "Maths · G9 · 9C", stats: [["Slides", "11"], ["Linked", "Lesson 7"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Presentations"
        plain="Slide "
        em="decks"
        sub="Build slide-based presentations linked to your lessons."
        neu="New presentation"
      />
      <Cnt>4 presentations</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvActivities() {
  const items = [
    { status: "Pair work", title: "Sort the light-reaction cards", meta: "Science · G7 · 7A", stats: [["Time", "10 min"], ["Materials", "Card set"]] },
    { status: "Group task", title: "Build a leaf cross-section poster", meta: "Science · G7 · 7A", stats: [["Time", "20 min"], ["Materials", "A3 + pens"]] },
    { status: "Individual", title: "Label-the-diagram worksheet", meta: "Science · G7 · 7B", stats: [["Time", "10 min"], ["Materials", "Printable"]] },
    { status: "Group task", title: "Debate: is fusion worth it?", meta: "Science · G10 · 10D", stats: [["Time", "25 min"], ["Materials", "Prompt"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Activities"
        plain="Classroom "
        em="activities"
        sub="Pair-work, group tasks, individual exercises — with materials and timing."
        neu="New activity"
      />
      <Cnt>4 activities</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvTemplates() {
  const items = [
    { status: "Template", title: "Inquiry-led science lesson", meta: "Science · KG–G6", stats: [["Stages", "4"], ["Duration", "50 min"], ["Used", "23×"]] },
    { status: "Template", title: "Exam revision carousel", meta: "Any · G7–G12", stats: [["Stages", "5"], ["Duration", "45 min"], ["Used", "61×"]] },
    { status: "Template", title: "Reading circle", meta: "English · G3–G9", stats: [["Stages", "4"], ["Duration", "40 min"], ["Used", "38×"]] },
    { status: "Template", title: "Problem-set practice", meta: "Maths · G6–G12", stats: [["Stages", "3"], ["Duration", "35 min"], ["Used", "47×"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Templates"
        plain="Templates "
        em="library"
        sub="Pick a starting point. Edit it once, reuse it forever."
        neu="New template"
      />
      <Cnt>4 templates</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvDrafts() {
  const items = [
    { status: "In progress", title: "The Water Cycle", meta: "Science · G7 · 7A", stats: [["Updated", "Today"], ["Progress", "80%"]] },
    { status: "In progress", title: "Fractions — introduction", meta: "Maths · G5 · 5B", stats: [["Updated", "Yesterday"], ["Progress", "45%"]] },
    { status: "Paused", title: "Romeo & Juliet — Act 1", meta: "English · G10 · 10D", stats: [["Updated", "May 12"], ["Progress", "60%"]] },
    { status: "In progress", title: "Photosynthesis", meta: "Science · G7 · 7A", stats: [["Updated", "May 15"], ["Progress", "25%"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Drafts"
        plain="Your "
        em="drafts"
        sub="Lesson plans you started, paused, or saved to reuse later. Only you can see these."
        neu="New draft"
      />
      <Cnt>4 drafts</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

// ── Weekly Schedule — mirrors the Planner/Schedule grid chrome.
function PvSchedule() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const grid = {
    Mon: ["7A · Biology", "", "9C · Chemistry"],
    Tue: ["", "8B · Biology", ""],
    Wed: ["7A · Biology", "10D · English", ""],
    Thu: ["", "9C · Chemistry", "Lab prep"],
    Fri: ["8B · Biology", "", "7A · Quiz"],
  };
  return (
    <div>
      <h2 className="font-serif text-[28px] font-medium text-ink leading-none tracking-tight mb-1">
        Week of <em className="italic font-medium text-accent">17 May</em>
      </h2>
      <p className="font-serif italic text-[12.5px] text-muted mb-4">
        Your teaching week — periods, classes, and prep at a glance.
      </p>
      <div className="grid grid-cols-5 gap-2">
        {days.map((d) => (
          <div key={d} className="text-center">
            <div className={`${EB} mb-2`}>{d}</div>
            <div className="flex flex-col gap-2">
              {grid[d].map((c, i) => (
                <div
                  key={i}
                  className={`h-[92px] rounded-lg border text-[11px] p-2 flex items-start ${
                    c
                      ? "border-accent/30 bg-accent/[0.07] text-accent font-medium"
                      : "border-line/70 bg-paper-cool text-transparent"
                  }`}
                >
                  {c || "·"}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── My Students — roster, mirroring the Database screen chrome.
function PvStudents() {
  const rows = [
    ["Aisha Al-Hashimi", "7A", "92%", "Present", "text-sage"],
    ["Bilal Haddad", "7A", "78%", "Present", "text-sage"],
    ["Fatima Rahman", "7A", "85%", "Late", "text-gold"],
    ["Hamad Khalil", "7A", "67%", "Absent · note", "text-accent"],
    ["Layla Saleh", "7A", "94%", "Present", "text-sage"],
    ["Omar Nasr", "7A", "81%", "Present", "text-sage"],
    ["Sara Yousef", "7A", "88%", "Present", "text-sage"],
  ];
  return (
    <div>
      <p className={`${EB} mb-2 inline-flex items-center gap-2.5`}>
        <span className="w-6 h-px bg-accent" /> My students
      </p>
      <h2 className="font-serif text-[28px] font-medium text-ink leading-tight">
        Class <em className="italic font-light text-accent">7A</em>
      </h2>
      <p className="text-muted text-[12.5px] mt-1.5 mb-4">
        28 students · attendance, grades and guardian contacts in one place.
      </p>
      <div className="rounded-2xl border border-line bg-paper-cool overflow-hidden">
        <div className="grid grid-cols-[1fr_70px_70px_120px] font-mono text-[9px] uppercase tracking-[0.15em] text-muted border-b border-line px-4 py-2.5">
          <span>Student</span>
          <span>Class</span>
          <span>Avg</span>
          <span>Today</span>
        </div>
        {rows.map(([n, cl, g, a, c]) => (
          <div
            key={n}
            className="grid grid-cols-[1fr_70px_70px_120px] items-center px-4 py-2.5 border-b border-line/60 last:border-0"
          >
            <span className="flex items-center gap-3">
              <span className="h-7 w-7 rounded-full bg-paper-warm/70 grid place-items-center text-[10px] font-medium">
                {n.split(" ").map((x) => x[0]).join("")}
              </span>
              <span className="text-[13px] text-ink">{n}</span>
            </span>
            <span className="text-[12px] text-muted">{cl}</span>
            <span className="text-[12px] font-mono text-ink-soft">{g}</span>
            <span className={`text-[12px] ${c}`}>{a}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Studio — the generate surface (prompt → draft → output).
function PvStudio() {
  return (
    <div>
      <p className={`${EB} mb-2 inline-flex items-center gap-2.5`}>
        <span className="w-6 h-px bg-accent" /> Studio
      </p>
      <h2 className="font-serif text-[28px] font-medium text-ink leading-tight mb-4">
        Mudir <em className="italic font-light text-accent">drafts.</em> You direct.
      </h2>
      <div className="rounded-xl border border-line bg-paper-cool p-4 mb-3.5">
        <p className={`${EB} mb-2`}>You said</p>
        <p className="text-[13px] leading-relaxed">
          Worksheet on photosynthesis for Grade 7. Three difficulty levels.
          One diagram-label question. MoE-aligned.
        </p>
      </div>
      <div className="flex items-center gap-2 mb-4">
        {["Listening", "Outlining", "Drafting", "Ready"].map((s, i) => (
          <React.Fragment key={s}>
            <span
              className={`text-[11px] font-mono px-2.5 py-1 rounded-md ${
                i === 3 ? "bg-sage/[0.14] text-sage" : "bg-paper-warm/60 text-muted"
              }`}
            >
              {s}
            </span>
            {i < 3 && <span className="w-3 h-px bg-line" />}
          </React.Fragment>
        ))}
      </div>
      <p className={`${EB} mb-3`}>Mudir drafted</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Level 1", "Foundation", "8 questions"],
          ["Level 2", "Core", "10 questions"],
          ["Level 3", "Extension", "12 questions"],
        ].map(([l, d, n]) => (
          <div key={l} className="rounded-xl border border-line bg-paper-cool p-3">
            <p className={`${EB} mb-1.5`}>{l}</p>
            <p className="text-[13px] font-medium">{d}</p>
            <p className="text-[12px] text-muted">{n}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Worksheets — the differentiated set the Studio produces.
function PvWorksheets() {
  const levels = [
    ["Level 1", "Foundation", "8 questions", "from-sage/15"],
    ["Level 2", "Core", "10 questions", "from-accent/15"],
    ["Level 3", "Extension", "12 questions", "from-gold/15"],
  ];
  return (
    <div>
      <p className={`${EB} mb-2 inline-flex items-center gap-2.5`}>
        <span className="w-6 h-px bg-accent" /> Worksheets
      </p>
      <h2 className="font-serif text-[28px] font-medium text-ink leading-tight">
        One topic, <em className="italic font-light text-accent">three levels</em>
      </h2>
      <p className="text-muted text-[12.5px] mt-1.5 mb-5">
        Photosynthesis · differentiated · printable PDF + answer key.
      </p>
      <div className="grid grid-cols-3 gap-4">
        {levels.map(([l, d, n, g]) => (
          <div
            key={l}
            className={`rounded-2xl border border-line bg-gradient-to-b ${g} to-transparent p-5 h-[250px] flex flex-col`}
          >
            <p className={`${EB} mb-2`}>{l}</p>
            <p className="font-serif text-xl font-medium mb-1">{d}</p>
            <p className="text-[12px] text-muted">{n}</p>
            <div className="mt-auto flex flex-col gap-1.5">
              <span className="h-2 rounded bg-line/50" />
              <span className="h-2 rounded bg-line/50 w-4/5" />
              <span className="h-2 rounded bg-line/50 w-3/5" />
            </div>
            <span className="mt-3 text-[11px] font-mono px-2 py-1 rounded bg-paper-cool border border-line text-muted self-start">
              PDF + key
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reports — mirrors Reports.jsx (counts strip + per-student table).
function PvReports() {
  const counts = [
    ["Students", 28], ["Lessons", 14], ["Templates", 9], ["Quizzes", 6],
    ["Homework", 8], ["Slides", 5], ["Activities", 11],
  ];
  const rows = [
    ["Aisha Al-Hashimi", "7A", 6, 92],
    ["Bilal Haddad", "7A", 5, 78],
    ["Fatima Rahman", "7A", 6, 85],
    ["Hamad Khalil", "7A", 4, 67],
    ["Layla Saleh", "7A", 6, 94],
  ];
  return (
    <div>
      <p className={`${EB} mb-2 inline-flex items-center gap-2.5`}>
        <span className="w-6 h-px bg-accent" /> Reports
      </p>
      <h2 className="font-serif text-[28px] font-medium text-ink leading-tight">
        Class <em className="italic font-light text-accent">reports</em>
      </h2>
      <p className="text-muted text-[12.5px] mt-1.5 mb-4">
        A snapshot of your class — averages, counts, exportable to CSV.
      </p>
      <div className="grid grid-cols-7 gap-2 mb-4">
        {counts.map(([l, v]) => (
          <div key={l} className="rounded-xl border border-[#e6dccb] bg-paper-cool p-2.5">
            <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted mb-1">
              {l}
            </p>
            <p className="font-serif text-xl font-medium text-accent leading-none">
              {v}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-line bg-paper-cool overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-line">
          <h3 className="font-serif text-lg font-medium text-ink">
            Per-student averages
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted border-b border-line">
              <th className="text-left py-2.5 px-5 font-medium">Student</th>
              <th className="text-left py-2.5 font-medium">Class</th>
              <th className="text-left py-2.5 font-medium">Entries</th>
              <th className="text-left py-2.5 px-5 font-medium">Average</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([n, cl, e, avg]) => (
              <tr key={n} className="border-b border-line/60 last:border-0">
                <td className="py-2.5 px-5 text-ink text-[13px]">{n}</td>
                <td className="py-2.5 text-muted text-[13px]">{cl}</td>
                <td className="py-2.5 text-ink-soft text-[13px]">{e}</td>
                <td className="py-2.5 px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-28 h-1.5 bg-paper-warm rounded-full overflow-hidden border border-line">
                      <div
                        className={`h-full ${
                          avg >= 70 ? "bg-sage" : avg >= 50 ? "bg-ink" : "bg-accent"
                        }`}
                        style={{ width: `${avg}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-ink-soft w-10">
                      {avg}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TeacherShowcase = () => {
  const FEATURES = [
    { label: "Lesson Plans", icon: BookOpen, title: "lessons / photosynthesis · 7A", Pv: PvLesson },
    { label: "Quizzes & Exams", icon: GraduationCap, title: "quiz / cell respiration · 7B", Pv: PvQuiz },
    { label: "Homework", icon: ClipboardList, title: "homework / worksheet 4 · 7A", Pv: PvHomework },
    { label: "Presentations", icon: Presentation, title: "deck / photosynthesis", Pv: PvPresentation },
    { label: "Activities", icon: Sparkles, title: "activities / 7A", Pv: PvActivities },
    { label: "Weekly Schedule", icon: CalendarDays, title: "schedule / week of 17 may", Pv: PvSchedule },
    { label: "My Students", icon: Users, title: "students / 7A", Pv: PvStudents },
    { label: "AI Studio", icon: MessageCircle, title: "studio / new worksheet", Pv: PvStudio },
    { label: "Worksheets", icon: FileText, title: "worksheets / photosynthesis", Pv: PvWorksheets },
    { label: "Reports & Insights", icon: BarChart3, title: "reports / term 2 · 7A", Pv: PvReports },
    { label: "Templates", icon: Layout, title: "templates / library", Pv: PvTemplates },
    { label: "Drafts", icon: FileText, title: "drafts / mine", Pv: PvDrafts },
  ];
  const [active, setActive] = useState(0);
  const f = FEATURES[active];
  const Pv = f.Pv;

  const Pill = ({ i }) => {
    const F = FEATURES[i];
    const Icon = F.icon;
    const on = i === active;
    return (
      <button
        type="button"
        onClick={() => setActive(i)}
        aria-pressed={on}
        className={`group w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all ${
          on
            ? "bg-gradient-to-r from-accent to-accent-soft text-paper-cool shadow-[0_14px_30px_-12px_rgba(200,71,43,0.55)]"
            : "bg-paper-cool border border-line text-ink hover:border-accent/40 hover:-translate-y-0.5"
        }`}
      >
        <span
          className={`inline-flex h-8 w-8 rounded-xl items-center justify-center flex-shrink-0 ${
            on ? "bg-white/15 text-paper-cool" : "bg-paper-warm/60 text-accent"
          }`}
        >
          <Icon size={16} strokeWidth={2} />
        </span>
        <span className="text-[14px] font-semibold leading-tight">
          {F.label}
        </span>
      </button>
    );
  };

  return (
    <section className="py-24 md:py-36">
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <div className="eyebrow mb-5">Inside Mudir</div>
          <h2 className="font-display text-4xl md:text-5xl leading-[1.05] tracking-tight">
            Everything a teacher prepares.
            <br />
            <em style={{ color: "var(--clay)" }}>Drafted in one place.</em>
          </h2>
        </div>

        <div className="grid gap-5 lg:gap-7 lg:grid-cols-[230px_minmax(0,1fr)_230px] items-center">
          {/* Mobile: all pills in a grid above the preview */}
          <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {FEATURES.map((_, i) => (
              <Pill key={i} i={i} />
            ))}
          </div>

          {/* Desktop: left column */}
          <div className="hidden lg:flex flex-col gap-3">
            {FEATURES.slice(0, 6).map((_, i) => (
              <Pill key={i} i={i} />
            ))}
          </div>

          {/* Centre preview */}
          <div className="w-full">
            <Win title={f.title}>
              <Pv />
            </Win>
          </div>

          {/* Desktop: right column */}
          <div className="hidden lg:flex flex-col gap-3">
            {FEATURES.slice(6, 12).map((_, i) => (
              <Pill key={i + 6} i={i + 6} />
            ))}
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
      <TeacherShowcase />
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
