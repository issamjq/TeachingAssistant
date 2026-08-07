"use client";

// =====================================================================
// Hero artifacts — the six card faces for the landing title sequence.
//
// Each card is a *specimen* of one teaching artifact: the thing Murchid
// makes, drawn as type and vector rather than photographed. They replace
// 24 baked PNGs (~11 MB) that carried their own text and so needed a
// separate Arabic build; these read the dictionary, so RTL is free.
//
// Slot ids are the original hero keys (lesson/quiz/deck/…) and are NOT
// the displayed concept — the product tour renumbered them. The mapping
// is fixed by HERO_CARDS order and the atl.art.* labels:
//
//   lesson → Quizzes        quiz  → Homework      deck     → Presentations
//   presentation → Planner  activity → Activities homework → AI Studio
//
// Grounds alternate light/dark down that order so the settled contents
// row reads as a rhythm rather than six of the same thing.
// =====================================================================
import React from "react";
import { useI18n, useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import s from "./HeroArtifact.module.css";

export type ArtifactKind =
  | "lesson"
  | "quiz"
  | "deck"
  | "presentation"
  | "activity"
  | "homework";

export interface HeroArtifactProps {
  kind: ArtifactKind;
  /** "a" = the Science set (hero arc), "b" = the Maths set (contents index). */
  variant?: "a" | "b";
}

// Every `.b` key used below is declared in en.ts alongside its base key, so
// the suffixed lookup is always a real TranslationKey. TypeScript can't see
// that through a template literal, hence the single cast here rather than
// one at each call site.
const bKey = (k: string): TranslationKey => `${k}.b` as TranslationKey;

export default function HeroArtifact({ kind, variant = "a" }: HeroArtifactProps) {
  const t = useT();
  const { isRTL } = useI18n();
  // Topical strings swap with the variant; structural ones don't.
  const tv = (k: string): string =>
    t(variant === "b" ? bKey(k) : (k as TranslationKey));
  const tk = (k: string): string => t(k as TranslationKey);

  const ground = KIND_GROUND[kind];
  const cls = `${s.card} ${ground === "dark" ? s.dark : s.light}`;

  // ── 01 · Quizzes ───────────────────────────────────────────────
  if (kind === "lesson") {
    const opts = [
      { label: tv("atl.card.lesson.o1"), on: true },
      { label: tv("atl.card.lesson.o2"), on: false },
      { label: tv("atl.card.lesson.o3"), on: false },
    ];
    return (
      <div className={cls}>
        <span className={s.eyebrow}>{tk("atl.card.lesson.eyebrow")}</span>
        <h4 className={s.title}>{tv("atl.card.lesson.title")}</h4>
        <div className={s.rule} />
        <div className={s.body}>
          {opts.map((o) => (
            <div key={o.label} className={`${s.opt} ${o.on ? s.optOn : ""}`}>
              <span className={s.dot}>
                {o.on && (
                  <svg className={s.tick} viewBox="0 0 8 8" fill="none" aria-hidden="true">
                    <path
                      d="M1.4 4.2 L3.1 5.9 L6.6 2.3"
                      stroke="#fff"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span>{o.label}</span>
            </div>
          ))}
        </div>
        <div className={s.foot}>{tk("atl.card.lesson.foot")}</div>
      </div>
    );
  }

  // ── 02 · Homework ──────────────────────────────────────────────
  if (kind === "quiz") {
    const marks = ["A", "M", "S", "R"];
    const tints = [
      "oklch(0.78 0.1 195)",
      "oklch(0.72 0.09 175)",
      "oklch(0.82 0.08 205)",
      "oklch(0.68 0.1 190)",
    ];
    return (
      <div className={cls}>
        <span className={s.eyebrow}>{tk("atl.card.quiz.eyebrow")}</span>
        <h4 className={s.title}>{tv("atl.card.quiz.title")}</h4>
        <div className={s.rule} />
        <div className={s.body}>
          <div style={{ fontFamily: "'Inter Tight', system-ui, sans-serif", fontSize: 11, opacity: 0.78 }}>
            {tv("atl.card.quiz.due")}
          </div>
          <div className={s.statRow}>
            <span className={s.statN}>64%</span>
            <span className={s.statL}>{tk("atl.card.quiz.foot")}</span>
          </div>
          <div className={s.meter}>
            <div className={s.meterFill} style={{ width: "64%" }} />
          </div>
          <div className={s.avatars}>
            {marks.map((m, i) => (
              <span key={m} className={s.avatar} style={{ background: tints[i] }}>
                {m}
              </span>
            ))}
          </div>
        </div>
        <div className={s.foot}>{tk("atl.desc.quiz")}</div>
      </div>
    );
  }

  // ── 03 · Presentations ─────────────────────────────────────────
  if (kind === "deck") {
    return (
      <div className={cls}>
        <span className={s.eyebrow}>{tk("atl.card.deck.eyebrow")}</span>
        <h4 className={s.title}>{tv("atl.card.deck.title")}</h4>
        <div className={s.slideStack}>
          <div className={`${s.slide} ${s.slideBack2}`} />
          <div className={`${s.slide} ${s.slideBack1}`} />
          <div className={`${s.slide} ${s.slideFront}`}>
            <div className={s.slideCap}>{tv("atl.card.deck.slide")}</div>
            <div className={s.slideArt}>
              {/* A horizon: water below, sun above — legible at 40% scale. */}
              <svg viewBox="0 0 180 60" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">
                <circle cx="138" cy="18" r="9" fill="oklch(0.95 0.06 190 / 0.85)" />
                <path d="M0 42 Q 30 32 60 42 T 120 42 T 180 42 V60 H0 Z" fill="oklch(0.98 0.01 200 / 0.4)" />
                <path d="M0 50 Q 34 41 68 50 T 136 50 T 200 50 V60 H0 Z" fill="oklch(0.99 0.005 200 / 0.55)" />
              </svg>
            </div>
          </div>
        </div>
        <div className={s.dots}>
          <span className={`${s.pip} ${s.pipOn}`} />
          <span className={s.pip} />
          <span className={s.pip} />
          <span className={s.pip} />
        </div>
        <div className={s.foot}>{tk("atl.card.deck.foot")}</div>
      </div>
    );
  }

  // ── 04 · Planner ───────────────────────────────────────────────
  if (kind === "presentation") {
    const dayNames = isRTL ? ["ن", "ث", "ر", "خ", "ج"] : ["M", "T", "W", "T", "F"];
    // A plausible week: a couple of doubles, a free Wednesday morning.
    const plan = [
      "a", "", "b", "", "c",
      "", "b", "a", "c", "",
      "c", "a", "", "b", "b",
      "", "c", "a", "", "a",
    ];
    const tone = (v: string) =>
      v === "a" ? s.cellA : v === "b" ? s.cellB : v === "c" ? s.cellC : "";
    return (
      <div className={cls}>
        <span className={s.eyebrow}>{tk("atl.card.presentation.eyebrow")}</span>
        <h4 className={s.title}>{tv("atl.card.presentation.title")}</h4>
        <div className={s.rule} />
        <div className={s.days}>
          {dayNames.map((d, i) => (
            <span key={i} className={s.dayName}>
              {d}
            </span>
          ))}
        </div>
        <div className={s.grid}>
          {plan.map((v, i) => (
            <span key={i} className={`${s.cell} ${tone(v)}`} />
          ))}
        </div>
        <div className={s.foot}>{tk("atl.card.presentation.foot")}</div>
      </div>
    );
  }

  // ── 05 · Activities ────────────────────────────────────────────
  if (kind === "activity") {
    return (
      <div className={cls}>
        <span className={s.eyebrow}>{tk("atl.card.activity.eyebrow")}</span>
        <h4 className={s.title}>{tv("atl.card.activity.title")}</h4>
        <div className={s.chips}>
          <span className={`${s.chip} ${s.chipOn}`}>{tk("atl.card.activity.c1")}</span>
          <span className={s.chip}>{tk("atl.card.activity.c2")}</span>
          <span className={s.chip}>{tk("atl.card.activity.c3")}</span>
        </div>
        {/* Three grouping modes as pure geometry: a pair, a cluster, a single. */}
        <svg className={s.geo} viewBox="0 0 196 112" fill="none" aria-hidden="true">
          {/* Pair — two overlapping discs */}
          <circle cx="26" cy="46" r="17" fill="oklch(0.62 0.1 200 / 0.9)" />
          <circle cx="52" cy="46" r="17" fill="oklch(0.62 0.1 200 / 0.42)" />
          {/* Group — a cluster of three */}
          <rect x="90" y="24" width="26" height="26" rx="6" fill="oklch(0.72 0.09 178 / 0.85)" />
          <rect x="120" y="24" width="26" height="26" rx="6" fill="oklch(0.72 0.09 178 / 0.5)" />
          <rect x="105" y="54" width="26" height="26" rx="6" fill="oklch(0.72 0.09 178 / 0.68)" />
          {/* Solo — one mark, standing apart */}
          <path d="M172 26 L190 62 H154 Z" fill="oklch(0.55 0.11 205 / 0.85)" />
          <line
            x1="10" y1="98" x2="186" y2="98"
            stroke="oklch(0.18 0.03 210 / 0.14)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        </svg>
        <div className={s.foot}>{tk("atl.desc.activity")}</div>
      </div>
    );
  }

  // ── 06 · AI Studio ─────────────────────────────────────────────
  return (
    <div className={cls}>
      <span className={s.eyebrow}>{tk("atl.card.homework.eyebrow")}</span>
      {/* The Murchid four-point spark, the mark used across the studio. */}
      <svg className={s.spark} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 0 C8.6 5 11 7.4 16 8 C11 8.6 8.6 11 8 16 C7.4 11 5 8.6 0 8 C5 7.4 7.4 5 8 0 Z"
          fill="currentColor"
        />
      </svg>
      <h4 className={s.title}>{tk("atl.card.homework.title")}</h4>
      <div className={s.prompt}>{tv("atl.card.homework.prompt")}</div>
      <div className={s.stream}>
        {[92, 100, 74, 88, 58].map((w, i) => (
          <span
            key={i}
            className={s.streamRow}
            style={{ width: `${w}%`, ["--r" as string]: i }}
          />
        ))}
      </div>
      <div className={s.foot}>{tk("atl.card.homework.foot")}</div>
    </div>
  );
}

// Light/dark alternation down the HERO_CARDS order.
const KIND_GROUND: Record<ArtifactKind, "light" | "dark"> = {
  lesson: "light",
  quiz: "dark",
  deck: "light",
  presentation: "dark",
  activity: "light",
  homework: "dark",
};
