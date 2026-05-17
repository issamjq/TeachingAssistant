import React, { useState, useEffect, useRef } from "react";
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
      <div className="max-w-[1280px] mx-auto px-8 py-5 flex items-center justify-between">
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
      className="relative min-h-screen pt-32 pb-32 overflow-hidden"
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

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: EASE, delay: 1.2 }}
          className="relative"
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
  const calendarDays = [
    [27, false, false, []], [28, false, false, []], [29, false, false, []], [30, false, false, []], [1, true, false, []], [2, true, false, []], [3, true, false, []],
    [4, true, false, []], [5, true, false, []], [6, true, false, []], [7, true, false, []], [8, true, false, []], [9, true, false, []], [10, true, false, []],
    [11, true, false, []], [12, true, false, []], [13, true, false, [{ label: "The Water Cycle" }]], [14, true, false, []], [15, true, false, []], [16, true, false, [{ label: "The Water Cycle" }]], [17, true, true, [{ label: "Photosynthesis" }, { label: "Lab prep" }]],
    [18, true, false, []], [19, true, false, [{ label: "Statistics intro" }, { label: "Presentation" }]], [20, true, false, []], [21, true, false, []], [22, true, false, []], [23, true, false, []], [24, true, false, []],
    [25, true, false, []], [26, true, false, []], [27, true, false, []], [28, true, false, []], [29, true, false, []], [30, true, false, []], [31, true, false, []],
  ];

  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          background: "var(--paper)",
          boxShadow:
            "0 40px 100px -25px rgba(42,31,23,0.25), 0 0 0 0.5px var(--line-strong)",
        }}
      >
        <div
          className="flex items-center gap-2 px-5 py-3.5 border-b"
          style={{ borderColor: "var(--line)", background: "var(--paper)" }}
        >
          <div className="dot" style={{ background: "#E3D9C5" }} />
          <div className="dot" style={{ background: "#E3D9C5" }} />
          <div className="dot" style={{ background: "#E3D9C5" }} />
          <div className="flex-1 flex justify-center">
            <div
              className="px-3 py-1 rounded-md text-xs font-mono"
              style={{ background: "var(--paper-2)", color: "var(--ink-3)" }}
            >
              mudir.app · planner
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 min-h-[640px]">
          {/* SIDEBAR */}
          <aside
            className="col-span-3 p-5 flex flex-col border-r"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center"
                style={{ background: "var(--brick)" }}
              >
                <span
                  className="font-display text-base font-medium"
                  style={{ color: "var(--paper)" }}
                >
                  M
                </span>
              </div>
              <span className="font-display text-xl">Mudir</span>
            </div>

            <div
              className="rounded-xl p-4 mb-6 relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, #3A1A14 0%, #5A2818 50%, #2A1F17 100%)",
                boxShadow: "0 8px 24px -8px rgba(90, 40, 24, 0.4)",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(247,243,236,0.1)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 1l1.5 4L13 6.5 9.5 8 8 12 6.5 8 3 6.5 6.5 5z"
                      fill="var(--brick-soft)"
                    />
                  </svg>
                </div>
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: "rgba(247,243,236,0.08)",
                    color: "rgba(247,243,236,0.6)",
                  }}
                >
                  AI
                </span>
              </div>
              <div
                className="font-display text-lg mb-1"
                style={{ color: "var(--paper)" }}
              >
                Studio
              </div>
              <div
                className="text-[10px] mb-1"
                style={{ color: "rgba(247,243,236,0.6)" }}
              >
                Your AI co-pilot for teaching
              </div>
              <div
                className="text-[10px] mb-3"
                style={{ color: "rgba(247,243,236,0.4)" }}
              >
                Create · Plan · Inspire
              </div>
              <button
                type="button"
                onClick={onOpenStudio}
                className="w-full text-xs py-2 rounded-md flex items-center justify-between px-3 transition-all hover:bg-white/5"
                style={{
                  background: "rgba(247,243,236,0.06)",
                  color: "var(--paper)",
                  border: "0.5px solid rgba(247,243,236,0.12)",
                }}
              >
                <span>Open Studio</span>
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M5 3l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1">
              <div
                className="font-display italic text-xs mb-2.5"
                style={{ color: "var(--ink-3)" }}
              >
                Planning
              </div>
              <div className="space-y-1 mb-5">
                <div
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer"
                  style={{ background: "var(--paper-2)", color: "var(--ink)" }}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background: "var(--paper-3)" }}
                  >
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ background: "var(--ink)" }}
                    />
                  </div>
                  Planner
                </div>
              </div>

              <div
                className="font-display italic text-xs mb-2.5"
                style={{ color: "var(--ink-3)" }}
              >
                Teaching
              </div>
              <div className="space-y-1 mb-5">
                {[
                  { k: "L", l: "Lesson Plans" },
                  { k: "Q", l: "Quizzes" },
                  { k: "H", l: "Homework" },
                  { k: "P", l: "Presentations" },
                  { k: "A", l: "Activities" },
                ].map((item) => (
                  <div
                    key={item.k}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer hover:bg-black/[0.03]"
                    style={{ color: "var(--ink-2)" }}
                  >
                    <div
                      className="w-5 h-5 rounded font-mono text-[9px] flex items-center justify-center"
                      style={{ background: "var(--paper-2)", color: "var(--ink-3)" }}
                    >
                      {item.k}
                    </div>
                    {item.l}
                  </div>
                ))}
              </div>

              <div
                className="font-display italic text-xs mb-2.5"
                style={{ color: "var(--ink-3)" }}
              >
                Data
              </div>
              <div className="space-y-1">
                <div
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer hover:bg-black/[0.03]"
                  style={{ color: "var(--ink-2)" }}
                >
                  <div
                    className="w-5 h-5 rounded font-mono text-[9px] flex items-center justify-center"
                    style={{ background: "var(--paper-2)", color: "var(--ink-3)" }}
                  >
                    C
                  </div>
                  My students
                </div>
              </div>
            </div>

            <div
              className="mt-4 pt-4 border-t"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="font-mono text-[10px]"
                  style={{ color: "var(--ink-3)" }}
                >
                  LANGUAGE
                </span>
                <div
                  className="flex items-center gap-0.5 rounded-md p-0.5"
                  style={{ background: "var(--paper-2)" }}
                >
                  <button
                    className="px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ background: "var(--paper)", color: "var(--ink)" }}
                  >
                    EN
                  </button>
                  <button
                    className="px-2 py-0.5 rounded text-[10px]"
                    style={{ color: "var(--ink-3)" }}
                  >
                    ع
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-2 rounded-md cursor-pointer hover:bg-black/[0.02]">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium"
                  style={{ background: "var(--paper-2)", color: "var(--ink)" }}
                >
                  SA
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium">Sara Al-Mansoori</div>
                  <div
                    className="font-display italic text-[10px]"
                    style={{ color: "var(--ink-3)" }}
                  >
                    Teacher
                  </div>
                </div>
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M5 3l4 4-4 4"
                    stroke="var(--ink-3)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </aside>

          {/* MAIN: CALENDAR */}
          <main className="col-span-6 p-7">
            <div className="mb-4">
              <h2 className="font-display text-4xl tracking-tight leading-none mb-1.5">
                May <em style={{ color: "var(--brick)" }}>2026</em>
              </h2>
              <p
                className="font-display italic text-xs"
                style={{ color: "var(--ink-2)" }}
              >
                Lesson plans, schedule, quizzes — all on one grid.
              </p>
            </div>

            <div className="flex items-center gap-1.5 mb-5 flex-wrap">
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium"
                style={{ background: "var(--ink)", color: "var(--paper)" }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: "rgba(247,243,236,0.3)" }}
                />
                All
              </button>
              {[
                { l: "Lesson Plans", dot: "var(--brick-soft)" },
                { l: "Schedule", dot: "#D4B895" },
                { l: "Quizzes", dot: "var(--brick-soft)" },
                { l: "Homework", dot: "#D4B895" },
                { l: "Activities", dot: "var(--brick-soft)" },
              ].map((p) => (
                <button
                  key={p.l}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px]"
                  style={{ background: "var(--paper-2)", color: "var(--ink-2)" }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: p.dot }}
                  />
                  {p.l}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1.5">
              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
                <div
                  key={d}
                  className="font-mono text-[9px] text-center py-1.5"
                  style={{ color: "var(--ink-3)" }}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map(([day, currentMonth, isToday, events], i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: currentMonth ? 1 : 0.35 }}
                  transition={{
                    duration: 0.4,
                    ease: EASE,
                    delay: 1.6 + i * 0.008,
                  }}
                  className="rounded-md p-1.5 min-h-[58px] relative"
                  style={{
                    background: isToday
                      ? "rgba(160, 57, 42, 0.06)"
                      : "var(--paper)",
                    border: isToday
                      ? "1px solid var(--brick)"
                      : "0.5px solid var(--line)",
                  }}
                >
                  <div className="flex items-start justify-between mb-1">
                    {isToday ? (
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-medium"
                        style={{ background: "var(--brick)", color: "var(--paper)" }}
                      >
                        {day}
                      </div>
                    ) : (
                      <span
                        className="text-[10px]"
                        style={{
                          color: currentMonth ? "var(--ink-2)" : "var(--ink-3)",
                        }}
                      >
                        {day}
                      </span>
                    )}
                    {events.length > 0 && (
                      <span
                        className="text-[8px] font-mono"
                        style={{ color: "var(--ink-3)" }}
                      >
                        {events.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {events.slice(0, 2).map((e, ei) => (
                      <div
                        key={ei}
                        className="flex items-center gap-1 text-[8px] truncate"
                        style={{ color: "var(--brick-deep)" }}
                      >
                        <div
                          className="w-1 h-1 rounded-full flex-shrink-0"
                          style={{ background: "var(--brick)" }}
                        />
                        <span className="truncate">{e.label}</span>
                      </div>
                    ))}
                  </div>
                  {isToday && (
                    <svg
                      className="absolute bottom-1 right-1"
                      width="9"
                      height="9"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M8 1l1.5 4L13 6.5 9.5 8 8 12 6.5 8 3 6.5 6.5 5z"
                        fill="var(--brick)"
                      />
                    </svg>
                  )}
                </motion.div>
              ))}
            </div>
          </main>

          {/* RIGHT RAIL */}
          <aside
            className="col-span-3 p-5 border-l"
            style={{ borderColor: "var(--line)", background: "var(--paper)" }}
          >
            <div className="flex items-center gap-1.5 mb-5">
              <button
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium"
                style={{
                  background: "rgba(160,57,42,0.08)",
                  color: "var(--brick-deep)",
                  border: "0.5px solid rgba(160,57,42,0.2)",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M7 3v8M3 7h8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Schedule
              </button>
              <button
                className="font-display italic text-xs px-2 py-2"
                style={{ color: "var(--ink-2)" }}
              >
                Today
              </button>
              <button
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "var(--paper-2)" }}
              >
                <svg width="8" height="8" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M9 3L5 7l4 4"
                    stroke="var(--ink-2)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: "var(--paper-2)" }}
              >
                <svg width="8" height="8" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M5 3l4 4-4 4"
                    stroke="var(--ink-2)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div
              className="rounded-xl p-4 mb-5"
              style={{ background: "var(--paper-2)" }}
            >
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-display text-sm">This month</h3>
                <span
                  className="font-mono text-[9px]"
                  style={{ color: "var(--ink-3)" }}
                >
                  MAY 2026
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { v: "6", l: "Planned", c: "var(--brick)" },
                  { v: "2", l: "Done", c: "var(--sage)" },
                  { v: "4", l: "To do", c: "var(--ink-2)" },
                ].map((s) => (
                  <div key={s.l}>
                    <div
                      className="font-display text-2xl leading-none mb-0.5"
                      style={{ color: s.c }}
                    >
                      {s.v}
                    </div>
                    <div
                      className="font-display italic text-[10px]"
                      style={{ color: "var(--ink-2)" }}
                    >
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="font-mono text-[9px]"
                  style={{ color: "var(--ink-3)" }}
                >
                  PROGRESS
                </span>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "var(--sage)" }}
                >
                  ↑ 33%
                </span>
              </div>
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "var(--paper-3)" }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "33%" }}
                  transition={{ duration: 1.2, ease: EASE, delay: 2 }}
                  className="h-full rounded-full"
                  style={{ background: "var(--sage)" }}
                />
              </div>
            </div>

            <div className="mb-5">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="font-display text-sm">Upcoming</h3>
                <button
                  className="font-display italic text-[10px]"
                  style={{ color: "var(--brick-deep)" }}
                >
                  View all
                </button>
              </div>
              <div className="space-y-2.5">
                {[
                  { d: "17", m: "MAY", t: "Photosynthesis lab" },
                  { d: "17", m: "MAY", t: "Quiz · cell respiration" },
                  { d: "19", m: "MAY", t: "Statistics introduction" },
                  { d: "19", m: "MAY", t: "Term presentation" },
                ].map((u, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="text-center flex-shrink-0">
                      <div
                        className="font-mono text-[8px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        {u.m}
                      </div>
                      <div className="font-display text-base leading-tight">
                        {u.d}
                      </div>
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="text-[11px] font-medium leading-tight">
                        {u.t}
                      </div>
                      <div
                        className="font-display italic text-[10px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        All day
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display text-sm mb-3">Quick actions</h3>
              <div className="space-y-1.5">
                {[
                  { l: "New lesson plan" },
                  { l: "New quiz" },
                  { l: "New homework" },
                  { l: "New presentation" },
                ].map((a) => (
                  <button
                    key={a.l}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-[11px] hover:bg-black/[0.02]"
                    style={{
                      background: "var(--paper)",
                      border: "0.5px solid var(--line)",
                    }}
                  >
                    <span>{a.l}</span>
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M7 3v8M3 7h8"
                        stroke="var(--ink-3)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ duration: 1.1, ease: EASE, delay: 1.8 }}
        className="absolute -bottom-8 -right-4 md:-right-12 card p-4 max-w-[240px] hidden md:block"
        style={{
          background: "var(--paper)",
          boxShadow: "0 20px 50px -10px rgba(42,31,23,0.15)",
        }}
      >
        <div className="eyebrow mb-2">Saved this week</div>
        <div
          className="font-display text-3xl mb-1"
          style={{ color: "var(--brick)" }}
        >
          11h 40m
        </div>
        <div
          className="font-display italic text-xs"
          style={{ color: "var(--ink-3)" }}
        >
          Average across UAE pilot teachers
        </div>
      </motion.div>
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
