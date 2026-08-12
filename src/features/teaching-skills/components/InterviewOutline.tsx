"use client";

// The interview's right rail: the profile assembling itself, live — the
// wide-screen answer to "why am I answering all this?". Every answered
// topic is a way back in, same as its step dot.
import { QUESTIONS, answeredCount } from "../interview";
import s from "./TeachingSkills.module.css";

export function InterviewOutline({
  answers,
  step,
  maxStep,
  onGo,
}: {
  answers: Record<string, string>;
  step: number;
  maxStep: number;
  onGo: (i: number) => void;
}) {
  return (
    <aside className={s.outline} aria-label="Your profile so far">
      <p className={s.eyebrow}>Your profile so far</p>
      <div className={s.outlineList}>
        {QUESTIONS.map((qq, i) => {
          const a = answers[qq.id]?.trim();
          const state = i === step ? "current" : a ? "answered" : i < maxStep ? "skipped" : "todo";
          return (
            <button
              key={qq.id}
              type="button"
              className={s.outlineItem}
              data-state={state}
              disabled={i > maxStep}
              onClick={() => onGo(i)}
            >
              <span className={s.outlineHead}>
                <span className={s.outlineNum}>{i + 1}</span>
                {qq.heading}
              </span>
              {a ? (
                <span className={s.outlineText}>{a}</span>
              ) : state === "skipped" ? (
                <span className={s.outlineSkip}>Skipped — tap to answer</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className={s.outlineFoot}>
        {answeredCount(answers)} of {QUESTIONS.length} answered · anything here is editable
      </p>
    </aside>
  );
}
