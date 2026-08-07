"use client";

// =====================================================================
// Hero artifacts — one card face per product module.
//
// These are the eight top-level modules from new-docs/LMS_Project_Report
// §3–§8, not a flattened list of one module's outputs. The previous six
// (Quizzes, Homework, Presentations, Planner, Activities, AI Studio)
// were all capabilities of §3.1 AI Studio alone, presented as though
// they were the whole product.
//
//   studio     §3.1  AI Studio — the content workspace
//   planner    §3.3  Goal Preparation — syllabus to a dated plan
//   profile    §3.4  Faculty Skills — the profile that personalises output
//   roster     §3.2  Subjects & Students — workspaces and cohorts
//   proctor    §5    Exam proctoring, client-side (Phase 2)
//   insights   §7    Dashboard — analytics and AI insights
//   schedule   §6    Scheduling — one calendar, conflict-aware
//   assistant  §8    Platform assistant chatbot
//
// Each is a drawn specimen of what the module produces, in vector and
// live type — so it stays crisp across the scroll's scale ramp and reads
// Arabic straight from the dictionary. Grounds alternate light/dark down
// the row so the settled index reads as a rhythm.
// =====================================================================
import React from "react";
import { useI18n, useT } from "@/shared/i18n";
import type { TranslationKey } from "@/shared/i18n";
import s from "./HeroArtifact.module.css";

export type ArtifactKind =
  | "studio" | "planner" | "profile" | "roster"
  | "proctor" | "insights" | "schedule" | "assistant";

export interface HeroArtifactProps {
  kind: ArtifactKind;
  /** Kept for the hero's A→B cross-fade; varies the sample content only. */
  variant?: "a" | "b";
}

const GROUND: Record<ArtifactKind, "light" | "dark"> = {
  studio: "dark", planner: "light", profile: "dark", roster: "light",
  proctor: "dark", insights: "light", schedule: "dark", assistant: "light",
};

const Tick = () => (
  <svg viewBox="0 0 8 8" fill="none" aria-hidden="true" className={s.tick}>
    <path d="M1.4 4.2 L3.1 5.9 L6.6 2.3" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function HeroArtifact({ kind, variant = "a" }: HeroArtifactProps) {
  const t = useT();
  const { isRTL } = useI18n();
  const tk = (k: string): string => t(k as TranslationKey);
  const b = variant === "b";
  const cls = `${s.card} ${GROUND[kind] === "dark" ? s.dark : s.light}`;
  const head = (
    <>
      <span className={s.eyebrow}>{tk(`atl.art.${kind}`)}</span>
      <h4 className={s.title}>{tk(`atl.desc.${kind}`)}</h4>
    </>
  );

  // ── §3.1 AI Studio ─────────────────────────────────────────────
  if (kind === "studio") {
    return (
      <div className={cls}>
        <svg className={s.spark} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 0 C8.6 5 11 7.4 16 8 C11 8.6 8.6 11 8 16 C7.4 11 5 8.6 0 8 C5 7.4 7.4 5 8 0 Z" fill="currentColor" />
        </svg>
        {head}
        <div className={s.prompt}>
          {b ? "A Grade 9 physics lesson on the second law"
             : "A Grade 7 lesson on photosynthesis"}
        </div>
        <div className={s.stream}>
          {[92, 100, 74, 88, 58].map((w, i) => (
            <span key={i} className={s.streamRow} style={{ width: `${w}%`, ["--r" as string]: i }} />
          ))}
        </div>
        <div className={s.foot}>Lesson · Quiz · Deck · Homework</div>
      </div>
    );
  }

  // ── §3.3 Goal Preparation ──────────────────────────────────────
  if (kind === "planner") {
    // 30 days. Tone marks the phase: foundations, the weight of it, revision.
    const days = Array.from({ length: 30 }, (_, i) =>
      i < 10 ? "a" : i < 24 ? "b" : "c");
    return (
      <div className={cls}>
        {head}
        <div className={s.rule} />
        <div className={s.planGrid}>
          {days.map((d, i) => (
            <span key={i} className={`${s.day} ${d === "a" ? s.dayA : d === "b" ? s.dayB : s.dayC}`} />
          ))}
        </div>
        <div className={s.legend}>
          <span><i className={s.dayA} /> Foundations</span>
          <span><i className={s.dayB} /> Core</span>
          <span><i className={s.dayC} /> Revision</span>
        </div>
        <div className={s.foot}>{b ? "480 pages · 30 days" : "500 pages · 30 days"}</div>
      </div>
    );
  }

  // ── §3.4 Faculty Skills ────────────────────────────────────────
  if (kind === "profile") {
    const traits: [string, number][] = b
      ? [["Pace", 0.5], ["Visual", 0.82], ["Frequent checks", 0.7], ["Warm", 0.9]]
      : [["Pace", 0.68], ["Visual", 0.55], ["Frequent checks", 0.86], ["Formal", 0.44]];
    return (
      <div className={cls}>
        {head}
        <div className={s.rule} />
        <div className={s.traits}>
          {traits.map(([label, v]) => (
            <div key={label} className={s.trait}>
              <span className={s.traitL}>{label}</span>
              <span className={s.traitBar}><i style={{ width: `${v * 100}%` }} /></span>
            </div>
          ))}
        </div>
        <div className={s.foot}>profile.md · referenced everywhere</div>
      </div>
    );
  }

  // ── §3.2 Subjects & Students ───────────────────────────────────
  if (kind === "roster") {
    const rows: [string, string, string][] = b
      ? [["A", "Aisha N.", "94"], ["R", "Rami H.", "88"], ["S", "Sara P.", "81"], ["Y", "Yusuf K.", "76"]]
      : [["L", "Layla H.", "96"], ["O", "Omar K.", "91"], ["M", "Mariam B.", "84"], ["F", "Faisal A.", "79"]];
    return (
      <div className={cls}>
        {head}
        <div className={s.rule} />
        <div className={s.rHead}><span>Student</span><span>Score</span></div>
        <div className={s.rows}>
          {rows.map(([ini, name, score], i) => (
            <div key={name} className={s.rRow}>
              <span className={s.rAv} style={{ ["--av" as string]: `oklch(${0.78 - i * 0.05} 0.09 ${190 + i * 8})` }}>{ini}</span>
              <span className={s.rName}>{name}</span>
              <span className={s.rScore}>{score}</span>
            </div>
          ))}
        </div>
        <div className={s.foot}>{b ? "Grade 9 · Division B" : "Grade 7 · Division A"}</div>
      </div>
    );
  }

  // ── §5 Exam proctoring ─────────────────────────────────────────
  if (kind === "proctor") {
    const feeds = ["Camera", "Screen", "Microphone"];
    return (
      <div className={cls}>
        <span className={s.rec} aria-hidden="true"><i />LIVE</span>
        {head}
        <div className={s.rule} />
        <div className={s.feeds}>
          {feeds.map((f) => (
            <div key={f} className={s.feed}>
              <span className={s.feedDot} />
              <span>{f}</span>
              <Tick />
            </div>
          ))}
        </div>
        <div className={s.statRow}>
          <span className={s.statN}>0</span>
          <span className={s.statL}>flags raised</span>
        </div>
        <div className={s.foot}>Analysed in the browser</div>
      </div>
    );
  }

  // ── §7 Dashboard ───────────────────────────────────────────────
  if (kind === "insights") {
    const bars = b ? [46, 58, 54, 70, 82, 88] : [52, 49, 61, 58, 74, 86];
    return (
      <div className={cls}>
        {head}
        <div className={s.rule} />
        <div className={s.bars}>
          {bars.map((h, i) => (
            <span key={i} className={s.bar} style={{ height: `${h}%`, opacity: 0.45 + i * 0.09 }} />
          ))}
        </div>
        <div className={s.note}>
          <Tick />
          <span>{b ? "Division C is 8 points behind — try the same order." : "Division B gained 11 points after you moved the derivation first."}</span>
        </div>
        <div className={s.foot}>Six assessments · this term</div>
      </div>
    );
  }

  // ── §6 Scheduling ──────────────────────────────────────────────
  if (kind === "schedule") {
    const events: [string, string, string][] = b
      ? [["Mon 09:00", "Lesson · 9B", "a"], ["Wed 11:30", "Homework due", "b"], ["Fri 08:00", "Unit paper", "c"]]
      : [["Tue 10:00", "Lesson · 7A", "a"], ["Thu 13:00", "Quiz · 7A", "b"], ["Fri 09:30", "Unit paper", "c"]];
    return (
      <div className={cls}>
        {head}
        <div className={s.rule} />
        <div className={s.events}>
          {events.map(([time, name, tone]) => (
            <div key={time} className={`${s.ev} ${tone === "a" ? s.evA : tone === "b" ? s.evB : s.evC}`}>
              <span className={s.evTime}>{time}</span>
              <span className={s.evName}>{name}</span>
            </div>
          ))}
        </div>
        <div className={s.note}>
          <Tick />
          <span>No clashes across your subjects</span>
        </div>
        <div className={s.foot}>Week 12</div>
      </div>
    );
  }

  // ── §8 Platform assistant ──────────────────────────────────────
  return (
    <div className={cls}>
      {head}
      <div className={s.rule} />
      <div className={s.chat}>
        <div className={`${s.bubble} ${s.bubbleMe}`} dir={isRTL ? "rtl" : "ltr"}>
          {b ? "How do I import a division?" : "How do I set a paper to observed?"}
        </div>
        <div className={s.bubble}>
          {b ? "Open the subject, then Students → Import CSV." : "In the paper's settings, switch Observation on."}
        </div>
      </div>
      <div className={s.chips}>
        <span className={s.chip}>Set up a subject</span>
        <span className={s.chip}>Plan a term</span>
      </div>
      <div className={s.foot}>Knows every screen you are on</div>
    </div>
  );
}
