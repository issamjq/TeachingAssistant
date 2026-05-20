// First-run profile form. Sits between AuthPage (Google/Outlook) and
// OnboardingPage (plan picker) in the landing funnel.
//
// 3-step wizard, one screen each — keeps every step readable without
// scroll on phone/iPad. The full shape mirrors the My-Students →
// Teaching profile fields, so once Firebase lands we can POST the
// pending profile to /api/me (PATCH) and skip asking again.
//
//   step 1  Who are you?      firstName / lastName / staffId
//   step 2  What do you teach? majors (multi) + languages (multi)
//   step 3  Who do you teach?  grades (multi) + sections (multi) + bio
//
// Submit on step 3 writes a pending profile to localStorage and calls
// onDone() so the funnel advances to the plan picker.
import React, { useState } from "react";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { MAJORS, GRADE_LEVELS, QUIZ_LANGUAGES, QUIZ_SECTIONS } from "../../lib/enums";
import { setPendingProfile, getPendingProfile } from "../../lib/account";
import { useT, useI18n } from "../../lib/i18n";

const STEPS = ["identity", "subjects", "scope"];

const EMPTY = {
  firstName: "",
  lastName: "",
  staffId: "",
  bio: "",
  majors: [],
  languages: [],
  grades: [],
  sections: [],
};

export default function ProfileForm({ onDone, onBack }) {
  const t = useT();
  const { dir } = useI18n();
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState(() => ({ ...EMPTY, ...(getPendingProfile() || {}) }));

  const step = STEPS[stepIdx];
  const last = stepIdx === STEPS.length - 1;

  // Lightweight per-step validation — staff_id, bio, sections are all
  // optional; the rest must have something so we don't end up with an
  // empty teacher profile downstream.
  const valid =
    step === "identity"
      ? data.firstName.trim().length > 0 && data.lastName.trim().length > 0
      : step === "subjects"
        ? data.majors.length > 0 && data.languages.length > 0
        : data.grades.length > 0;

  const set = (patch) => setData((d) => ({ ...d, ...patch }));
  const toggleIn = (key, value) =>
    setData((d) => {
      const cur = d[key] || [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...d, [key]: next };
    });

  const next = () => {
    if (!valid) return;
    if (last) {
      setPendingProfile(data);
      onDone?.(data);
      return;
    }
    setStepIdx((i) => i + 1);
  };
  const back = () => {
    if (stepIdx === 0) onBack?.();
    else setStepIdx((i) => i - 1);
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-4 py-8 sm:py-12"
      style={{ background: "var(--paper)" }}
      dir={dir}
    >
      <div className="w-full max-w-[640px]">
        <ProgressDots count={STEPS.length} active={stepIdx} />
        <h1
          className="font-display text-3xl sm:text-4xl leading-tight mt-6 mb-2"
          style={{ color: "var(--ink)" }}
        >
          {t(`onb.${step}.title`)}
          <em className="italic font-light" style={{ color: "var(--clay)" }}>
            {" "}
            {t(`onb.${step}.titleEm`)}
          </em>
        </h1>
        <p className="text-sm sm:text-base mb-8" style={{ color: "var(--ink-3)" }}>
          {t(`onb.${step}.lead`)}
        </p>

        {step === "identity" && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={t("onb.fld.firstName")} required>
              <input
                type="text"
                value={data.firstName}
                onChange={(e) => set({ firstName: e.target.value })}
                autoFocus
                className="onb-input"
                placeholder={t("onb.ph.firstName")}
              />
            </Field>
            <Field label={t("onb.fld.lastName")} required>
              <input
                type="text"
                value={data.lastName}
                onChange={(e) => set({ lastName: e.target.value })}
                className="onb-input"
                placeholder={t("onb.ph.lastName")}
              />
            </Field>
            <Field label={t("onb.fld.staffId")} hint={t("onb.fld.optional")}>
              <input
                type="text"
                value={data.staffId}
                onChange={(e) => set({ staffId: e.target.value })}
                className="onb-input"
                placeholder={t("onb.ph.staffId")}
              />
            </Field>
          </div>
        )}

        {step === "subjects" && (
          <div className="space-y-6">
            <Field label={t("onb.fld.majors")} required>
              <ChipPicker
                options={MAJORS}
                selected={data.majors}
                onToggle={(v) => toggleIn("majors", v)}
              />
            </Field>
            <Field label={t("onb.fld.languages")} required>
              <ChipPicker
                options={QUIZ_LANGUAGES}
                selected={data.languages}
                onToggle={(v) => toggleIn("languages", v)}
              />
            </Field>
          </div>
        )}

        {step === "scope" && (
          <div className="space-y-6">
            <Field label={t("onb.fld.grades")} required>
              <ChipPicker
                options={GRADE_LEVELS}
                selected={data.grades}
                onToggle={(v) => toggleIn("grades", v)}
              />
            </Field>
            <Field label={t("onb.fld.sections")} hint={t("onb.fld.optional")}>
              <ChipPicker
                options={QUIZ_SECTIONS.filter((s) => s !== "All sections")}
                selected={data.sections}
                onToggle={(v) => toggleIn("sections", v)}
              />
            </Field>
            <Field label={t("onb.fld.bio")} hint={t("onb.fld.optional")}>
              <textarea
                value={data.bio}
                onChange={(e) => set({ bio: e.target.value })}
                rows={3}
                className="onb-input"
                placeholder={t("onb.ph.bio")}
              />
            </Field>
          </div>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-paper-warm"
            style={{ color: "var(--ink)" }}
          >
            <ChevronLeft size={16} className="rtl:rotate-180" />
            {stepIdx === 0 ? t("onb.back.signin") : t("onb.back.step")}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!valid}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {last ? t("onb.finish") : t("onb.next")}
            {last ? <Check size={16} /> : <ChevronRight size={16} className="rtl:rotate-180" />}
          </button>
        </div>
      </div>

      <style>{`
        .onb-input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border-radius: 0.625rem;
          border: 1px solid var(--line-strong, #d4c9b3);
          background: #fffdf6;
          color: var(--ink);
          font-size: 0.9375rem;
          outline: none;
          transition: border-color 120ms, box-shadow 120ms;
          font-family: inherit;
        }
        .onb-input:focus {
          border-color: var(--clay, #c8472b);
          box-shadow: 0 0 0 3px rgba(200, 71, 43, 0.12);
        }
      `}</style>
    </div>
  );
}

function ProgressDots({ count, active }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="h-1 flex-1 rounded-full transition-colors"
          style={{
            background: i <= active ? "var(--clay, #c8472b)" : "var(--line-strong, #d4c9b3)",
            opacity: i === active ? 1 : i < active ? 0.85 : 0.45,
          }}
        />
      ))}
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
          {label}
          {required && <span style={{ color: "var(--clay)" }}> *</span>}
        </span>
        {hint && (
          <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function ChipPicker({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
              on
                ? "bg-ink text-paper-cool border-ink"
                : "bg-paper-cool text-ink border-line hover:border-ink"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
