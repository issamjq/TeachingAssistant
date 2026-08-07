"use client";

// =====================================================================
// Stats band. Four figures, revealed on scroll with the same curtain +
// variable-axis treatment the landing's headlines use, staggered across
// the row so it reads left to right (right to left under RTL, since the
// stagger follows source order and the grid is direction-aware).
//
// Scroll-linked rather than transition-on-enter, matching every other
// reveal on this page: motion is a pure function of scroll position.
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import { useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import s from "./StatsBand.module.css";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Stat {
  /** Leading figure. */
  n: string;
  /** Trailing italic unit, rendered smaller. */
  unit?: string;
  labelKey: string;
}

const STATS: Stat[] = [
  { n: "5", unit: "min", labelKey: "ch.manifest.stat1" },
  { n: "KG", unit: "–12", labelKey: "ch.manifest.stat2" },
  { n: "MoE", labelKey: "ch.manifest.stat3" },
  { n: "2", unit: "lang", labelKey: "ch.stats.stat4" },
];

export default function StatsBand() {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setP(1);
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
        // 0 as the band's top crosses the viewport bottom, 1 once it has
        // risen a third of the way up the screen.
        setP(clamp01((vh - r.top) / (vh * 0.72)));
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
  }, []);

  return (
    <section ref={ref} className={s.band} aria-label={t("ch.stats.aria" as TranslationKey)}>
      <div className={s.grid}>
        {STATS.map((stat, i) => {
          const r = easeOut(clamp01((p - i * 0.07) / 0.5));
          return (
            <div key={stat.labelKey} className={s.cell} style={{ opacity: r }}>
              <div
                className={`${s.n} lm-mask`}
                style={{
                  "--lm": `${lerp(0, 118, r)}%`,
                  "--vf-wght": lerp(240, 340, r),
                  "--vf-opsz": lerp(20, 144, r),
                } as React.CSSProperties}
              >
                {stat.n}
                {stat.unit && <em>{stat.unit}</em>}
              </div>
              <div className={s.l} style={{ transform: `translateY(${lerp(10, 0, r)}px)` }}>
                {t(stat.labelKey as TranslationKey)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
