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
import { CARD_H, deckCenterX, deckPos, indexLayout } from "../hero-artifacts/indexLayout";
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
  // Same SSR placeholder discipline as HeroAtelier: never read window during
  // render, and seed both sides identically so the mount effect produces a
  // real state change React will actually re-render from.
  const [vw, setVw] = useState(1280);
  const [vh, setVh] = useState(800);

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
        setVw(window.innerWidth);
        setVh(window.innerHeight);
        const el = trackRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        setP(span > 0 ? clamp01(-r.top / span) : 0);
      });
    };
    setNarrow(window.innerWidth <= NARROW);
    setVw(window.innerWidth);
    setVh(window.innerHeight);
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

  // ── three phases ─────────────────────────────────────────────────
  //   A  0 → HOLD      the numbered contents row, exactly as the hero
  //                    left it — same layout function, same strings, so
  //                    the pin handoff is a continuous picture
  //   B  HOLD → GATHER the row collapses to the side and stacks into a
  //                    deck; numbers and the hero title fade out, the
  //                    walkthrough's own header fades in
  //   C  GATHER → 1    the deck deals through the six tools
  const HOLD = 0.1;
  const GATHER = 0.26;

  const L = indexLayout(N, vw, dir, isRTL);
  // Linear position within phase B, for staging the fades against each other.
  const gRaw = clamp01((p - HOLD) / (GATHER - HOLD));
  // Eased, for the geometry — so the row does not lurch out of the hold.
  const gather = smooth(gRaw);
  // The two headings must NOT cross-fade symmetrically. Overlapping them at
  // 50/50 superimposed two long serif lines in the same place and rendered
  // both illegible. The outgoing one clears before the incoming one starts.
  const rowOut = 1 - smooth(clamp01(gRaw / 0.42)); // hero title + numbers
  const deckIn = smooth(clamp01((gRaw - 0.62) / 0.38)); // walkthrough header
  const deckX = deckCenterX(vw, dir, narrow);
  // Deck centre relative to the pin centre.
  //
  // Desktop puts the detail BESIDE the deck, so the deck can sit near the
  // middle. Phones stack them, so the deck has to clear the upper third and
  // leave the lower half for the connector and copy — and that split has to
  // be a fraction of viewport height, not a fixed offset, or it breaks
  // between a 667pt phone and an 932pt one. The stage is pinned to the same
  // fraction in CSS (--tw-split).
  const SPLIT = 0.56;
  // The band the deck gets on a phone, derived rather than guessed. An
  // earlier fixed offset ignored the pin's own top padding and put the card
  // through the heading. Both values below mirror the CSS exactly:
  //   .pin  padding-block-start: clamp(72px, 12vh, 110px)
  //   .headSlot height: 84px  (narrow override)
  //   .stage inset-block-start: 56%
  const padTop = Math.min(110, Math.max(72, vh * 0.12));
  const bandTop = padTop + 84;
  const bandH = SPLIT * vh - bandTop;
  // A full-size 345px card does not fit that band on a short phone, so the
  // deck scales to whatever is actually available — this holds from a 667pt
  // phone through a 932pt one instead of only looking right on the one I
  // happened to test.
  const deckScale = narrow ? Math.max(0.5, Math.min(0.86, (bandH - 20) / CARD_H)) : 1;
  const deckY = narrow ? (bandTop + SPLIT * vh) / 2 - vh / 2 : 46;

  // ── selection (phase C) ──────────────────────────────────────────
  // prog runs 0→N across the remainder of the track. `active` is the card
  // in front and `local` is how far through its own slot we are.
  const cProg = clamp01((p - GATHER) / (1 - GATHER)) * N;
  const active = Math.min(Math.floor(cProg), N - 1);
  const local = clamp01(cProg - active);

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
            <div key={k} className={s.stackedItem}>
              <HeroArtifact kind={k} variant="b" />
              <div className={s.detail}>
                <Detail k={k} i={i} tk={tk} />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={trackRef} className={s.track} aria-label={tk("tw.over")}>
      <div className={s.pin}>
        {/* Two headings occupy the same slot. The hero's carries over into
            phase A so the handoff between pins is seamless; the
            walkthrough's replaces it as the deck gathers. */}
        <div className={s.headSlot}>
          <div className={s.headLayer} style={{ opacity: rowOut }} aria-hidden={rowOut < 0.5}>
            <span className={s.over}>{tk("atl.index.over")}</span>
            <h2 className={s.h2}>{tk("atl.index.title")}</h2>
          </div>
          <div className={s.headLayer} style={{ opacity: deckIn }} aria-hidden={deckIn < 0.5}>
            <span className={s.over}>{tk("tw.over")}</span>
            <h2 className={s.h2}>
              {tk("tw.h2.a")} <em>{tk("tw.h2.em")}</em>
            </h2>
          </div>
        </div>

        {/* Cards live in a layer spanning the whole pin, not inside the grid
            column, because in phase A they are a full-width row and only
            become a column-sized deck once gathered. */}
        <div className={s.cardLayer}>
          {KINDS.map((k, i) => {
            const rp = L.pos(i);
            // Distance from the front of the deck. Until the deck exists
            // (phase A/B) active and advance are both 0, so this is just i.
            const d = i - active - advance;
            const dp = deckPos(d, dir);
            const opacity = lerp(1, dp.opacity, gather);
            if (opacity <= 0.01) return null;
            const x = lerp(rp.x, deckX + dp.x, gather);
            const y = lerp(rp.y, deckY + dp.y, gather);
            const rot = lerp(0, dp.rot, gather);
            const sc = lerp(rp.s, dp.s * deckScale, gather);
            return (
              <div
                key={k}
                className={s.card}
                style={{
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rot}deg) scale(${sc})`,
                  opacity,
                  zIndex: 50 - Math.round(Math.abs(gather < 0.5 ? i : d) * 6),
                }}
                aria-hidden={gather > 0.5 && i !== active}
              >
                <HeroArtifact kind={k} variant="b" />
              </div>
            );
          })}

          {/* 01–06 labels. They ride WITH their card rather than staying put:
              pinned to the row while the cards swept away, they read as six
              stranded captions for a moment. */}
          {rowOut > 0.01 &&
            KINDS.map((k, i) => {
              const rp = L.pos(i);
              const dp = deckPos(i, dir);
              const lx = lerp(rp.x, deckX + dp.x, gather);
              const ly = lerp(rp.y, deckY + dp.y, gather);
              const ls = lerp(rp.s, dp.s * deckScale, gather);
              return (
                <div
                  key={`n-${k}`}
                  className={s.tocItem}
                  style={{
                    opacity: rowOut,
                    ["--toc-k" as string]: L.tocK,
                    transform: `translate(-50%, -100%) translate(${lx}px, ${ly - (CARD_H * ls) / 2 - 14}px)`,
                  }}
                >
                  <span className={s.tocNum}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={s.tocLabel}>{tk(`atl.art.${k}`)}</span>
                  <span className={s.tocDesc}>{tk(`atl.desc.${k}`)}</span>
                </div>
              );
            })}

          {/* Selection dot, on the trailing edge of the front card. */}
          <span
            className={s.dot}
            style={{
              transform: narrow
                ? `translate(-50%, -50%) translate(${deckX}px, ${deckY + 150 * deckScale}px) scale(${lerp(0.2, 1, dotIn)})`
                : `translate(-50%, -50%) translate(${deckX + 118 * dir}px, ${deckY}px) scale(${lerp(0.2, 1, dotIn)})`,
              opacity: dotIn,
            }}
          />
        </div>

        {/* Connector + detail. The first grid column is a spacer holding the
            deck's footprint; the cards themselves are in the layer above. */}
        <div className={s.stage}>
          <div aria-hidden="true" />
          <div className={s.wire}>
            {narrow ? (
              <svg viewBox="0 0 20 54" width="20" height="54" aria-hidden="true">
                <path className={s.wirePath} d="M10 0 V54" pathLength={1}
                  strokeDasharray={1} strokeDashoffset={1 - lineIn} />
              </svg>
            ) : (
              <svg viewBox="0 0 132 200" aria-hidden="true" style={{ transform: isRTL ? "scaleX(-1)" : undefined }}>
                <path className={s.wirePath} d="M0 100 H44 C68 100 68 74 92 74 H132" pathLength={1}
                  strokeDasharray={1} strokeDashoffset={1 - lineIn} />
              </svg>
            )}
          </div>
          <div
            className={s.detail}
            style={{
              opacity: textIn,
              transform: narrow
                ? `translateY(${lerp(14, 0, textIn)}px)`
                : `translate(${lerp(22, 0, textIn) * dir}px, 0)`,
            }}
          >
            <Detail k={KINDS[active]} i={active} tk={tk} />
          </div>
        </div>

        <div className={s.rail} style={{ opacity: deckIn }} aria-hidden="true">
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
