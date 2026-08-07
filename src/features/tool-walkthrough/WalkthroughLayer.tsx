"use client";

// =====================================================================
// The annotation half of the tool walkthrough: heading, connector,
// detail, progress rail.
//
// It does NOT own the cards. The cards belong to the hero's single
// pinned timeline, which carries them from the opening fan through the
// numbered index row and on into this deck. That is the whole point of
// the merge — previously the hero ended on the index row and a second
// pinned section opened on the same row, so the row scrolled away and
// then scrolled back, which read as a duplicate rather than a
// continuation. Two sticky elements cannot hand off mid-flight; one
// timeline can.
//
// So this is a presentational layer driven entirely by progress values
// the hero computes.
// =====================================================================
import React from "react";
import { useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import HeroArtifact, { type ArtifactKind } from "../hero-artifacts/HeroArtifact";
import s from "./ToolWalkthrough.module.css";

export const TOOL_KINDS: ArtifactKind[] = ["studio", "planner", "profile", "roster", "proctor", "insights", "schedule", "assistant"];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface WalkthroughLayerProps {
  /** Index of the selected tool. */
  active: number;
  /** Progress through the selected tool's own slot, 0→1. */
  local: number;
  /** 0 while the cards are still the index row, 1 once fully a deck. */
  gather: number;
  /** Fade-in for this layer's own heading — staged behind `gather`. */
  headIn: number;
  dotIn: number;
  lineIn: number;
  textIn: number;
  narrow: boolean;
  isRTL: boolean;
}

export default function WalkthroughLayer({
  active, local, gather, headIn, lineIn, textIn, narrow, isRTL,
}: WalkthroughLayerProps) {
  const t = useT();
  const tk = (k: string): string => t(k as TranslationKey);
  const dir = isRTL ? -1 : 1;

  return (
    <>
      <div className={s.headLayer} style={{ opacity: headIn }} aria-hidden={headIn < 0.5}>
        <span className={s.over}>{tk("tw.over")}</span>
        <h2 className={s.h2}>
          {tk("tw.h2.a")} <em>{tk("tw.h2.em")}</em>
        </h2>
      </div>

      <div className={s.stage} style={{ opacity: gather, pointerEvents: gather > 0.9 ? "auto" : "none" }}>
        {/* Column 1 is a spacer for the deck's footprint; the cards live in
            the hero's card layer, which spans the whole pin. */}
        <div aria-hidden="true" />
        <div className={s.wire}>
          {narrow ? (
            <svg viewBox="0 0 20 54" width="20" height="54" aria-hidden="true">
              <path className={s.wirePath} d="M10 0 V54" pathLength={1}
                strokeDasharray={1} strokeDashoffset={1 - lineIn} />
            </svg>
          ) : (
            <svg viewBox="0 0 132 200" aria-hidden="true"
              style={{ transform: isRTL ? "scaleX(-1)" : undefined }}>
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
          <ToolDetail k={TOOL_KINDS[active]} i={active} tk={tk} />
        </div>
      </div>

      <div className={s.rail} style={{ opacity: gather }} aria-hidden="true">
        {TOOL_KINDS.map((k, i) => (
          <span key={k} className={s.tick}>
            <span
              className={s.tickFill}
              style={{ transform: `scaleX(${i < active ? 1 : i === active ? local : 0})` }}
            />
          </span>
        ))}
      </div>
    </>
  );
}

/** Reduced-motion fallback: no deck, no scrub — every tool as a plain row. */
export function WalkthroughStacked() {
  const t = useT();
  const tk = (k: string): string => t(k as TranslationKey);
  return (
    <div className={s.stackedWrap}>
      <div className={s.headLayer} style={{ position: "static" }}>
        <span className={s.over}>{tk("tw.over")}</span>
        <h2 className={s.h2}>
          {tk("tw.h2.a")} <em>{tk("tw.h2.em")}</em>
        </h2>
      </div>
      {TOOL_KINDS.map((k, i) => (
        <div key={k} className={s.stackedItem}>
          <HeroArtifact kind={k} variant="b" />
          <div className={s.detail}>
            <ToolDetail k={k} i={i} tk={tk} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ToolDetail({ k, i, tk }: { k: ArtifactKind; i: number; tk: (s: string) => string }) {
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
