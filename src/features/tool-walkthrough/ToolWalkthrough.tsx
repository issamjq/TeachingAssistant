"use client";

// =====================================================================
// Tool walkthrough. A pinned deck that deals through the six artifacts,
// one selected at a time, each annotated with a dot, a drawn connector,
// and its detail.
//
// This section is pinned where four others were unpinned, and the reason
// is worth stating: a pin is only dead scroll when nothing changes while
// it holds. Here the whole point of the runway is that scrolling selects
// the next card, so every pixel buys a frame of content.
//
// All motion is a pure function of scroll — the same technique the rest
// of the landing uses, no timeline and nothing to keep in sync. Under
// prefers-reduced-motion the deck cannot deal, so the section renders as
// a plain stacked list instead: every tool visible, nothing hidden
// behind motion the reader asked not to see.
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import { useI18n, useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import HeroArtifact, { type ArtifactKind } from "../hero-artifacts/HeroArtifact";
import s from "./ToolWalkthrough.module.css";

const KINDS: ArtifactKind[] = ["lesson", "quiz", "deck", "presentation", "activity", "homework"];
const N = KINDS.length;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Eased 0→1 ramp across [a,b] of some progress value. */
const ramp = (v: number, a: number, b: number) => smooth(clamp01((v - a) / (b - a)));

const NARROW = 900;

export default function ToolWalkthrough({ onEnter }: { onEnter?: () => void }) {
  const t = useT();
  const { isRTL } = useI18n();
  const dir = isRTL ? -1 : 1;
  const trackRef = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) return undefined;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setNarrow(window.innerWidth <= NARROW);
        const el = trackRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        setP(span > 0 ? clamp01(-r.top / span) : 0);
      });
    };
    setNarrow(window.innerWidth <= NARROW);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const tk = (k: string): string => t(k as TranslationKey);

  // ── selection ────────────────────────────────────────────────────
  // prog runs 0→N across the track. `active` is the card in front and
  // `local` is how far through its own slot we are.
  const prog = clamp01(p) * N;
  const active = Math.min(Math.floor(prog), N - 1);
  const local = clamp01(prog - active);

  // The annotation lands, holds, then clears just before the next card
  // takes over — so the two never overlap mid-swap.
  const out = 1 - ramp(local, 0.88, 1);
  const dotIn = ramp(local, 0.04, 0.2) * out;
  const lineIn = ramp(local, 0.16, 0.46) * out;
  const textIn = ramp(local, 0.24, 0.5) * out;

  // How far the deck has moved toward the NEXT card. Flat for most of the
  // slot, then a quick hand-off at the very end.
  //
  // This is deliberately not `local`. Advancing the deck continuously meant
  // that by mid-slot the following card had already overtaken the selected
  // one at the front, so the detail panel described card N while card N+1
  // was the one you were looking at. Holding at 0 keeps the selected card
  // still and square-on for the whole time its annotation is on screen, and
  // the swap happens in the window where the annotation has cleared.
  const advance = ramp(local, 0.86, 1);

  const kind = KINDS[active];

  if (reduced) {
    return (
      <section className={s.track} aria-label={tk("tw.over")}>
        <div className={s.pin}>
          <header className={s.head}>
            <span className={s.over}>{tk("tw.over")}</span>
            <h2 className={s.h2}>
              {tk("tw.h2.a")} <em>{tk("tw.h2.em")}</em>
            </h2>
          </header>
          {KINDS.map((k, i) => (
            <div key={k} className={s.stage} style={{ marginBlockStart: 40 }}>
              <div className={s.deck} style={{ height: 380 }}>
                <HeroArtifact kind={k} variant="b" />
              </div>
              <div />
              <Detail k={k} i={i} tk={tk} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={trackRef} className={s.track} aria-label={tk("tw.over")}>
      <div className={s.pin}>
        <header className={s.head}>
          <span className={s.over}>{tk("tw.over")}</span>
          <h2 className={s.h2}>
            {tk("tw.h2.a")} <em>{tk("tw.h2.em")}</em>
          </h2>
        </header>

        <div className={s.stage}>
          {/* deck */}
          <div className={s.deck}>
            {KINDS.map((k, i) => {
              // Signed distance from the front of the deck. Negative once a
              // card has been passed, positive while it is still waiting.
              const d = i - active - advance;
              const back = d >= 0;
              const m = Math.abs(d);
              const x = (back ? 13 * d : -18 * m) * dir;
              const y = back ? 16 * d : -62 * m;
              const rot = (back ? 4.5 * d : -7 * m) * dir;
              const scale = back ? 1 - 0.055 * d : 1 - 0.06 * m;
              const opacity = back ? Math.max(0, 1 - d * 0.26) : Math.max(0, 1 - m * 1.5);
              if (opacity <= 0.01) return null;
              return (
                <div
                  key={k}
                  className={s.card}
                  style={{
                    transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
                    opacity,
                    zIndex: 50 - Math.round(m * 6),
                  }}
                  aria-hidden={i !== active}
                >
                  <HeroArtifact kind={k} variant="b" />
                </div>
              );
            })}

            {/* Selection dot, on the trailing edge of the front card. */}
            <span
              className={s.dot}
              style={{
                transform: narrow
                  ? `translate(-50%, -50%) translate(0, 150px) scale(${lerp(0.2, 1, dotIn)})`
                  : `translate(-50%, -50%) translate(${118 * dir}px, 0) scale(${lerp(0.2, 1, dotIn)})`,
                opacity: dotIn,
              }}
            />
          </div>

          {/* connector */}
          <div className={s.wire}>
            {narrow ? (
              <svg viewBox="0 0 20 54" width="20" height="54" aria-hidden="true">
                <path className={s.wirePath} d="M10 0 V54" pathLength={1}
                  strokeDasharray={1} strokeDashoffset={1 - lineIn} />
              </svg>
            ) : (
              <svg viewBox="0 0 132 200" aria-hidden="true" style={{ transform: isRTL ? "scaleX(-1)" : undefined }}>
                {/* Steps up from the dot to sit level with the detail title. */}
                <path className={s.wirePath} d="M0 100 H44 C68 100 68 74 92 74 H132" pathLength={1}
                  strokeDasharray={1} strokeDashoffset={1 - lineIn} />
              </svg>
            )}
          </div>

          {/* detail */}
          <div
            className={s.detail}
            style={{
              opacity: textIn,
              transform: narrow
                ? `translateY(${lerp(14, 0, textIn)}px)`
                : `translate(${lerp(22, 0, textIn) * dir}px, 0)`,
            }}
          >
            <Detail k={kind} i={active} tk={tk} />
          </div>
        </div>

        {/* progress rail */}
        <div className={s.rail} aria-hidden="true">
          {KINDS.map((k, i) => (
            <span key={k} className={s.tick}>
              <span
                className={s.tickFill}
                style={{ transform: `scaleX(${i < active ? 1 : i === active ? local : 0})` }}
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Detail({ k, i, tk }: { k: ArtifactKind; i: number; tk: (s: string) => string }) {
  return (
    <>
      <span className={s.num}>{String(i + 1).padStart(2, "0")}</span>
      <h3 className={s.name}>{tk(`atl.art.${k}`)}</h3>
      <p className={s.body}>{tk(`atl.more.${k}.body`)}</p>
      <ul className={s.list}>
        {[1, 2, 3].map((n) => (
          <li key={n} className={s.item}>
            <span className={s.check} aria-hidden="true">
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1.6 4.7 L3.6 6.7 L7.4 2.5" stroke="currentColor" strokeWidth="1.7"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>{tk(`atl.more.${k}.b${n}`)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
