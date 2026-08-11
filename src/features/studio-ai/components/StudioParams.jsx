"use client";

// Studio parameter panels.
//
// Every generator kind (quiz, activity, lesson, homework, presentation) has a
// panel of chips that shape what gets generated, plus the controls and
// constants those panels are built from. Extracted from views/Studio.jsx,
// which was 5,204 lines with the panels, their controls and their validation
// rules interleaved with the generation flow.
//
// Moved as one unit deliberately: the panels, DropdownChip/ComboboxMenu, and
// the REQUIRED_CHIPS / CHIP_VALIDATORS tables are mutually dependent, so
// splitting them further would only trade file size for import churn. The
// module imports nothing back from Studio.jsx, so the dependency direction
// stays one-way.
//
// This is MOVED code, not rewritten code: it carries two pre-existing
// set-state-in-effect patterns from Studio.jsx. Converting them is a
// behavioural change and belongs in its own commit, not in a move — so they
// are suppressed here with that reason recorded rather than silently fixed.
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Award, BookOpen, Calendar, Check, ChevronDown, ClipboardList, Clock, Gauge, Globe, GraduationCap, Hash, HelpCircle, ListChecks, Plus, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/views/_shared";
import { useT, useI18n } from "@/lib/i18n";
import { today } from "@/lib/localDate";
import {
  QUIZ_DIFFICULTIES,
  QUIZ_DURATIONS,
  QUIZ_QUESTION_COUNTS,
  QUIZ_QUESTION_MIXES,
  QUIZ_SECTIONS,
  GRADE_LEVELS,
  MAJORS,
} from "@/lib/enums";

export const ACTIVITY_TYPES = ["Individual", "Pair", "Group"];

export const ACTIVITY_DURATIONS = [10, 15, 20, 30, 45, 60];

export const LESSON_DURATIONS = [30, 45, 60, 75, 90];

export const PRESENTATION_SLIDES = [5, 8, 10, 12, 15, 20];

export const REQUIRED_CHIPS = {
  quiz:         ["grade", "major", "language", "section", "difficulty", "questions", "duration", "types", "total_marks"],
  lesson_plan:  ["grade", "major", "language", "section", "duration"],
  homework:     ["grade", "major", "language", "section"],
  activity:     ["type", "major", "language", "duration"],
  presentation: ["grade", "major", "language", "section", "slides"],
};

export const chipIsSet = (v) => v !== "" && v != null;

export const CHIP_VALIDATORS = {
  grade: (v) => {
    if (!v) return null;
    const s = String(v).trim();
    if (looksLikeGrade(s)) return null;
    if (looksLikeMajor(s)) return { reason: "That looks like a Major", suggestSlot: "major" };
    if (looksLikeDifficulty(s)) return { reason: "That looks like a Difficulty", suggestSlot: "difficulty" };
    if (looksLikeInteger(s)) return null; // could be a custom value
    return null;
  },
  major: (v) => {
    if (!v) return null;
    const s = String(v).trim();
    if (looksLikeGrade(s)) return { reason: "That looks like a Grade", suggestSlot: "grade" };
    if (looksLikeDifficulty(s)) return { reason: "That looks like a Difficulty", suggestSlot: "difficulty" };
    return null;
  },
  difficulty: (v) => {
    if (!v) return null;
    const s = String(v).trim();
    if (looksLikeDifficulty(s)) return null;
    if (looksLikeMajor(s)) return { reason: "That looks like a Major", suggestSlot: "major" };
    if (looksLikeGrade(s)) return { reason: "That looks like a Grade", suggestSlot: "grade" };
    return null;
  },
  questions: (v) => {
    if (v === "" || v == null) return null;
    if (!looksLikeInteger(v)) {
      const s = String(v).trim();
      if (looksLikeMajor(s)) return { reason: "Looks like a Major", suggestSlot: "major" };
      return { reason: "Should be a number", suggestSlot: null };
    }
    return null;
  },
  duration: (v) => {
    if (v === "" || v == null) return null;
    if (!looksLikeInteger(v)) {
      const s = String(v).trim();
      if (looksLikeMajor(s)) return { reason: "Looks like a Major", suggestSlot: "major" };
      return { reason: "Should be a number", suggestSlot: null };
    }
    return null;
  },
};

// Progress badge shown in each settings panel's header. Always visible:
// counts how many of the required chips are set, and flips to a green
// "All set" with a check once the teacher has chosen everything.

export function SetCountBadge({ count, total }) {
  const t = useT();
  const done = count >= total;
  return (
    <p className={`font-mono text-[10px] uppercase tracking-[0.14em] flex-shrink-0 inline-flex items-center gap-1 ${done ? "text-sage" : "text-accent"}`}>
      {done && <Check size={11} strokeWidth={2.5} />}
      {done ? t("studio.params.allSet") : t("studio.params.setCountN", { n: count, total })}
    </p>
  );
}

// Pre-prompt panel that sits ABOVE the input card. Big, clearly chunked
// settings block with a header so it doesn't read as decoration. Each
// field is a dropdown chip with an icon, an uppercase label, and a value
// area; the chip is sized big enough that an empty state ("Pick a grade")
// is impossible to miss. Every chip is required — the teacher chooses
// everything before Murchid will build.

export function QuizParamsPanel({ params, onChange, gradeOptions, majorOptions, languageOptions, sectionOptions }) {
  const t = useT();
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  // Count straight off REQUIRED_CHIPS.quiz (8 chips + Score) so the badge
  // and the "Make it" gate never disagree about what "all set" means.
  const setCount = REQUIRED_CHIPS.quiz.filter((k) => chipIsSet(params[k])).length;

  // Move this chip's current value into `targetSlot` and clear ours.
  // If `targetSlot` already has a value, swap them so nothing is lost.
  const moveTo = (fromSlot, targetSlot) => {
    if (!targetSlot) return;
    onChange((prev) => ({
      ...prev,
      [targetSlot]: prev[fromSlot],
      [fromSlot]: prev[targetSlot] ?? "",
    }));
  };

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">
            {t("studio.params.quiz")}
          </p>
          <p className="font-serif text-base text-ink leading-snug">
            {t("studio.params.subtitleLead")} <span className="italic text-muted">{t("studio.params.subtitleTail")}</span>
          </p>
        </div>
        <SetCountBadge count={setCount} total={REQUIRED_CHIPS.quiz.length} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label={t("studio.chip.grade.label")}
          slot="grade"
          emptyHint={t("studio.chip.grade.empty")}
          help={t("studio.chip.grade.help")}
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
          warning={CHIP_VALIDATORS.grade(params.grade)}
          onMoveTo={(target) => moveTo("grade", target)}
        />
        <DropdownChip
          icon={BookOpen}
          label={t("studio.chip.major.label")}
          slot="major"
          emptyHint={t("studio.chip.major.empty")}
          help={t("studio.chip.major.help")}
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
          warning={CHIP_VALIDATORS.major(params.major)}
          onMoveTo={(target) => moveTo("major", target)}
        />
        <DropdownChip
          icon={Globe}
          label={t("studio.chip.language.label")}
          slot="language"
          emptyHint={t("studio.chip.language.empty")}
          help={t("studio.chip.language.help")}
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label={t("studio.chip.section.label")}
          slot="section"
          emptyHint={t("studio.chip.section.empty")}
          help={t("studio.chip.section.help")}
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
        <DropdownChip
          icon={Gauge}
          label={t("studio.chip.difficulty.label")}
          slot="difficulty"
          emptyHint={t("studio.chip.difficulty.empty")}
          help={t("studio.chip.difficulty.help")}
          value={params.difficulty}
          options={QUIZ_DIFFICULTIES}
          onChange={(v) => set({ difficulty: v })}
          warning={CHIP_VALIDATORS.difficulty(params.difficulty)}
          onMoveTo={(target) => moveTo("difficulty", target)}
        />
        <DropdownChip
          icon={Hash}
          label={t("studio.chip.questions.label")}
          slot="questions"
          emptyHint={t("studio.chip.questions.empty")}
          help={t("studio.chip.questions.help")}
          value={
            params.questions === "" || params.questions == null
              ? ""
              : String(params.questions)
          }
          options={QUIZ_QUESTION_COUNTS.map(String)}
          onChange={(v) => set({ questions: v === "" ? "" : Number(v) })}
          warning={CHIP_VALIDATORS.questions(params.questions)}
          onMoveTo={(target) => moveTo("questions", target)}
          numeric
        />
        <DropdownChip
          icon={Clock}
          label={t("studio.chip.duration.label")}
          slot="duration"
          emptyHint={t("studio.chip.duration.empty")}
          help={t("studio.chip.duration.help")}
          value={
            params.duration === "" || params.duration == null
              ? ""
              : String(params.duration)
          }
          options={QUIZ_DURATIONS.map(String)}
          onChange={(v) => set({ duration: v === "" ? "" : Number(v) })}
          warning={CHIP_VALIDATORS.duration(params.duration)}
          onMoveTo={(target) => moveTo("duration", target)}
          suffix="min"
          numeric
        />
        <DropdownChip
          icon={ListChecks}
          label={t("studio.chip.types.label")}
          slot="types"
          emptyHint={t("studio.chip.types.empty")}
          help={t("studio.chip.types.help")}
          value={params.types}
          options={QUIZ_QUESTION_MIXES}
          onChange={(v) => set({ types: v })}
        />
      </div>

      {/* Scheduled date — separate from the chips because it's a date
          picker, not a list. Persists straight onto the saved quiz row
          so the Schedule view and Quizzes & Exams list pick it up. */}
      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
        score={params.total_marks}
        onScoreChange={(v) => set({ total_marks: v })}
      />
      <InstructionsRow
        mode={params.instructions_mode}
        text={params.instructions}
        onModeChange={(v) => set({ instructions_mode: v })}
        onTextChange={(v) => set({ instructions: v })}
      />
    </div>
  );
}

// Activity settings panel — same shape as QuizParamsPanel (eyebrow,
// chip grid, schedule-for date row) but with activity-specific labels.
// Per the chip rules, no Grade and no Section. Type sits in the slot
// Grade would normally occupy so the grid stays balanced.

export function ActivityParamsPanel({ params, onChange, majorOptions, languageOptions }) {
  const t = useT();
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.type, params.major, params.language, params.duration,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">
            {t("studio.params.activity")}
          </p>
          <p className="font-serif text-base text-ink leading-snug">
            {t("studio.params.subtitleLead")} <span className="italic text-muted">{t("studio.params.subtitleTail")}</span>
          </p>
        </div>
        <SetCountBadge count={setCount} total={4} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <DropdownChip
          icon={Users}
          label={t("studio.chip.type.label")}
          slot="type"
          emptyHint={t("studio.chip.type.empty")}
          help={t("studio.chip.type.help")}
          value={params.type}
          options={ACTIVITY_TYPES}
          onChange={(v) => set({ type: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label={t("studio.chip.major.label")}
          slot="major"
          emptyHint={t("studio.chip.major.empty")}
          help={t("studio.chip.major.help")}
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label={t("studio.chip.language.label")}
          slot="language"
          emptyHint={t("studio.chip.language.empty")}
          help={t("studio.chip.language.help")}
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Clock}
          label={t("studio.chip.duration.label")}
          slot="duration"
          emptyHint={t("studio.chip.duration.empty")}
          help={t("studio.chip.duration.help")}
          value={
            params.duration === "" || params.duration == null
              ? ""
              : String(params.duration)
          }
          options={ACTIVITY_DURATIONS.map(String)}
          onChange={(v) => set({ duration: v === "" ? "" : Number(v) })}
          suffix="min"
          numeric
        />
      </div>

      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
      />
    </div>
  );
}

// Lesson plan settings — Grade + Major + Language + Section + Duration.
// Schedule-for date row anchors the lesson on the calendar.

export function LessonParamsPanel({ params, onChange, gradeOptions, majorOptions, languageOptions, sectionOptions }) {
  const t = useT();
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section, params.duration,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">{t("studio.params.lesson")}</p>
          <p className="font-serif text-base text-ink leading-snug">
            {t("studio.params.subtitleLead")} <span className="italic text-muted">{t("studio.params.subtitleTail")}</span>
          </p>
        </div>
        <SetCountBadge count={setCount} total={5} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label={t("studio.chip.grade.label")}
          slot="grade"
          emptyHint={t("studio.chip.grade.empty")}
          help={t("studio.chip.grade.help")}
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label={t("studio.chip.major.label")}
          slot="major"
          emptyHint={t("studio.chip.major.empty")}
          help={t("studio.chip.major.help")}
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label={t("studio.chip.language.label")}
          slot="language"
          emptyHint={t("studio.chip.language.empty")}
          help={t("studio.chip.language.help")}
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label={t("studio.chip.section.label")}
          slot="section"
          emptyHint={t("studio.chip.section.empty")}
          help={t("studio.chip.section.help")}
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
        <DropdownChip
          icon={Clock}
          label={t("studio.chip.duration.label")}
          slot="duration"
          emptyHint={t("studio.chip.duration.empty")}
          help={t("studio.chip.duration.help")}
          value={
            params.duration === "" || params.duration == null
              ? ""
              : String(params.duration)
          }
          options={LESSON_DURATIONS.map(String)}
          onChange={(v) => set({ duration: v === "" ? "" : Number(v) })}
          suffix="min"
          numeric
        />
      </div>

      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
      />
    </div>
  );
}

// Homework settings — Grade + Major + Language + Section. The
// schedule-for date doubles as the due date for the assignment.

export function HomeworkParamsPanel({ params, onChange, gradeOptions, majorOptions, languageOptions, sectionOptions }) {
  const t = useT();
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">{t("studio.params.homework")}</p>
          <p className="font-serif text-base text-ink leading-snug">
            {t("studio.params.subtitleLead")} <span className="italic text-muted">{t("studio.params.subtitleTail")}</span>
          </p>
        </div>
        <SetCountBadge count={setCount} total={4} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label={t("studio.chip.grade.label")}
          slot="grade"
          emptyHint={t("studio.chip.grade.empty")}
          help={t("studio.chip.grade.help")}
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label={t("studio.chip.major.label")}
          slot="major"
          emptyHint={t("studio.chip.major.empty")}
          help={t("studio.chip.major.help")}
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label={t("studio.chip.language.label")}
          slot="language"
          emptyHint={t("studio.chip.language.empty")}
          help={t("studio.chip.language.help")}
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label={t("studio.chip.section.label")}
          slot="section"
          emptyHint={t("studio.chip.section.empty")}
          help={t("studio.chip.section.help")}
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
      </div>

      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
        score={params.total_marks}
        onScoreChange={(v) => set({ total_marks: v })}
        scoreOptional
      />
    </div>
  );
}

// Presentation settings — Grade + Major + Language + Section + Slides.
// Schedule-for anchors the deck on the calendar.

export function PresentationParamsPanel({ params, onChange, gradeOptions, majorOptions, languageOptions, sectionOptions }) {
  const t = useT();
  const set = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const setCount = [
    params.grade, params.major, params.language, params.section, params.slides,
  ].filter((v) => v !== "" && v != null).length;

  return (
    <div className="mb-3 rounded-2xl border border-line bg-paper-warm/40 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
      <div className="flex items-end justify-between gap-3 mb-2.5">
        <div>
          <p className="font-serif italic text-base text-muted mb-0.5">{t("studio.params.presentation")}</p>
          <p className="font-serif text-base text-ink leading-snug">
            {t("studio.params.subtitleLead")} <span className="italic text-muted">{t("studio.params.subtitleTail")}</span>
          </p>
        </div>
        <SetCountBadge count={setCount} total={5} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <DropdownChip
          icon={GraduationCap}
          label={t("studio.chip.grade.label")}
          slot="grade"
          emptyHint={t("studio.chip.grade.empty")}
          help={t("studio.chip.grade.help")}
          value={params.grade}
          options={gradeOptions}
          onChange={(v) => set({ grade: v })}
        />
        <DropdownChip
          icon={BookOpen}
          label={t("studio.chip.major.label")}
          slot="major"
          emptyHint={t("studio.chip.major.empty")}
          help={t("studio.chip.major.help")}
          value={params.major}
          options={majorOptions}
          onChange={(v) => set({ major: v })}
        />
        <DropdownChip
          icon={Globe}
          label={t("studio.chip.language.label")}
          slot="language"
          emptyHint={t("studio.chip.language.empty")}
          help={t("studio.chip.language.help")}
          value={params.language}
          options={languageOptions}
          onChange={(v) => set({ language: v })}
        />
        <DropdownChip
          icon={Users}
          label={t("studio.chip.section.label")}
          slot="section"
          emptyHint={t("studio.chip.section.empty")}
          help={t("studio.chip.section.help")}
          value={params.section}
          options={sectionOptions}
          onChange={(v) => set({ section: v })}
          multi
        />
        <DropdownChip
          icon={Hash}
          label={t("studio.chip.slides.label")}
          slot="slides"
          emptyHint={t("studio.chip.slides.empty")}
          help={t("studio.chip.slides.help")}
          value={
            params.slides === "" || params.slides == null
              ? ""
              : String(params.slides)
          }
          options={PRESENTATION_SLIDES.map(String)}
          onChange={(v) => set({ slides: v === "" ? "" : Number(v) })}
          numeric
        />
      </div>

      <ScheduledDateRow
        value={params.scheduled_for}
        onChange={(v) => set({ scheduled_for: v })}
      />
    </div>
  );
}

// `scoreOptional` — when true (homework), an empty score input renders with a
// muted dashed border instead of the accent-red dashed border that signals
// "this field is required and unset" on the quiz panel.

export function ScheduledDateRow({ value, onChange, score, onScoreChange, scoreOptional = false }) {
  const t = useT();
  const todayISO = today();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          <Calendar size={11} strokeWidth={1.75} />
          {t("studio.schedule.label")}
          <HelpTip text={t("studio.schedule.help")} />
        </span>
        <DatePicker
          value={value ? String(value).slice(0, 10) : ""}
          min={todayISO}
          onChange={(v) => onChange(v || "")}
          className="bg-paper-cool border border-line rounded-md px-2.5 py-1 text-sm text-ink outline-none focus:border-accent transition-colors duration-150 min-w-[160px]"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="font-serif italic text-xs text-muted hover:text-accent transition-colors duration-150"
          >
            {t("studio.schedule.clear")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange(todayISO)}
            className="font-serif italic text-xs text-muted hover:text-accent transition-colors duration-150"
          >
            {t("studio.schedule.today")}
          </button>
        )}
      </span>

      {onScoreChange && (
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            <Award size={11} strokeWidth={1.75} />
            {t("studio.schedule.score")}
            <HelpTip text={t("studio.score.help")} />
          </span>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={score ?? ""}
            onChange={(e) => onScoreChange(e.target.value)}
            placeholder={t("studio.schedule.scorePlaceholder")}
            className={`w-20 bg-paper-cool border rounded-md px-2.5 py-1 text-sm text-ink outline-none focus:border-accent transition-colors duration-150 normal-case tracking-normal font-sans ${
              chipIsSet(score)
                ? "border-line"
                : scoreOptional
                ? "border-dashed border-line"
                : "border-dashed border-accent/60"
            }`}
          />
        </span>
      )}
    </div>
  );
}

// The instruction line printed at the top of the quiz hand-out ("Read each
// question carefully…"). Three modes: Auto (Murchid writes it), Custom (the
// teacher's own text, revealed in a textarea), or None (omit it). Defaults
// to None — the teacher opts into Auto or Custom.

export function InstructionsRow({ mode, text, onModeChange, onTextChange }) {
  const t = useT();
  const m = mode || "none";
  const OPTIONS = [
    ["auto", t("studio.instructions.auto")],
    ["custom", t("studio.instructions.custom")],
    ["none", t("studio.instructions.none")],
  ];
  return (
    <div className="mt-2 px-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          <ClipboardList size={11} strokeWidth={1.75} />
          {t("studio.instructions.label")}
          <HelpTip text={t("studio.instructions.help")} />
        </span>
        <div className="inline-flex rounded-md border border-line overflow-hidden">
          {OPTIONS.map(([v, label], i) => (
            <button
              key={v}
              type="button"
              onClick={() => onModeChange(v)}
              className={`px-3 py-1 text-xs font-sans transition-colors duration-150 ${i > 0 ? "border-s border-line" : ""} ${
                m === v ? "bg-ink text-paper-cool" : "bg-paper-cool text-muted hover:text-ink hover:bg-paper-warm"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {m === "custom" && (
        <textarea
          rows={2}
          value={text ?? ""}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={t("studio.instructions.placeholder")}
          className="mt-2 w-full bg-paper-cool border border-line rounded-md px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent transition-colors duration-150 resize-y"
        />
      )}
    </div>
  );
}

// A combobox-style field-card. Looks like a form control closed; opens
// into a text input + filtered dropdown. Teachers can pick from the
// preset list OR type any custom value — typed text becomes the value
// even if it doesn't match anything in `options`.
//
//   ┌───────────────────────┐
//   │ ⊕ GRADE             ▾ │   header (icon + mono label + chevron)
//   │ Grade 8 / [type…  ]   │   value or input depending on open
//   └───────────────────────┘
//
// Closed empty: dashed border + italic "Any grade" hint.
// Closed filled: solid border + ink text.
// Open: focus ring, input replaces the value display, menu drops below.
// numeric: input forwards inputMode="numeric"; non-numeric typed values
//          are coerced or ignored on commit.
// Split a multi-select chip's value (joined comma-separated string) into
// its component selections. Empty / null safe.

export function DropdownChip({
  icon: Icon, label, emptyHint, help, value, options, onChange,
  suffix, numeric, warning, onMoveTo,
  // multi=true → chip stores a comma-separated string of picks.
  // Clicking an option TOGGLES it (menu stays open). Custom typed
  // values get appended. Click-outside / Done closes.
  multi = false,
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const inputRef = useRef(null);

  // Re-seed draft from external value when the chip is closed (resets, etc.)
  useEffect(() => {
    if (!open) setDraft(value == null ? "" : String(value));
  }, [value, open]);

  // Focus + select the input as soon as it appears so typing just works.
  // For multi mode we start the draft empty so typing filters/adds new
  // values rather than re-editing the already-picked joined string.
  useEffect(() => {
    if (!open) return;
    if (multi) setDraft("");
    const id = setTimeout(() => {
      inputRef.current?.focus();
      if (!multi) inputRef.current?.select();
    }, 0);
    return () => clearTimeout(id);
  }, [open, multi]);

  const openMenu = () => {
    setDraft(value == null ? "" : String(value));
    setOpen(true);
  };

  // Commit a value: trims, coerces to number for numeric chips, then
  // closes the menu. Invalid numeric input becomes empty (Any).
  const commit = (raw) => {
    let v = raw === "" || raw == null ? "" : String(raw).trim();
    if (numeric && v !== "") {
      const n = Number(v);
      v = Number.isFinite(n) && n > 0 ? String(n) : "";
    }
    onChange(numeric ? (v === "" ? "" : Number(v)) : v);
    setOpen(false);
  };

  // Multi-select handlers: toggle an option in the joined list without
  // closing the menu, and add a typed custom value to the list.
  const currentMulti = multi ? splitMulti(value) : [];
  const toggleMulti = (opt) => {
    const next = currentMulti.includes(opt)
      ? currentMulti.filter((x) => x !== opt)
      : [...currentMulti, opt];
    onChange(joinMulti(next));
    setDraft(""); // ready to filter / add the next
  };
  const addCustomMulti = (raw) => {
    const v = String(raw || "").trim();
    if (!v) return;
    if (currentMulti.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange(joinMulti([...currentMulti, v]));
    setDraft("");
  };

  const filteredOptions = useMemo(() => {
    // Numeric chips (DURATION, QUESTIONS) have a small, finite preset
    // list — typing a custom value should add to it, not filter it away.
    // The teacher needs to see every preset so they can re-pick a
    // different one without re-opening the chip.
    if (numeric) return options;
    if (!draft) return options;
    // When the draft is just reflecting the currently-picked value
    // (chip was just reopened, user hasn't typed yet), show every
    // option — otherwise re-opening "Biology" would hide Science,
    // Computer Science, etc., and the teacher couldn't switch.
    const currentValueStr = String(value == null ? "" : value);
    if (String(draft) === currentValueStr) return options;
    const q = String(draft).toLowerCase();
    return options.filter((o) => String(o).toLowerCase().includes(q));
  }, [draft, options, numeric, value]);

  const isSet = Boolean(value) || value === 0;
  const display = isSet
    ? suffix ? `${value} ${suffix}` : value
    : emptyHint || t("studio.combo.pickOrType");

  const hasWarning = Boolean(warning && !open);
  const cardClass = `w-full text-left rounded-lg border px-3 py-2 transition-all duration-150 ${
    open
      ? "bg-paper-cool border-ink shadow-[0_0_0_3px_rgba(200,71,43,0.12)]"
      : hasWarning
        ? "bg-paper-cool border-accent/70"
        : isSet
          ? "bg-paper-cool border-line hover:border-ink"
          : "bg-paper border-dashed border-line/80 hover:border-ink hover:bg-paper-cool"
  }`;

  const header = (
    <div className="flex items-center justify-between gap-2 mb-0.5">
      <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${
        isSet || open ? "text-ink-soft" : "text-muted"
      }`}>
        {Icon && <Icon size={11} strokeWidth={1.75} />}
        {label}
        {help && <HelpTip text={help} />}
      </span>
      <ChevronDown
        size={13}
        className={`flex-shrink-0 ${
          open ? "rotate-180 text-accent" : "text-muted"
        } transition-transform duration-150`}
      />
    </div>
  );

  // While open, bump the wrapper above the click-outside scrim so the
  // input + dropdown stay clickable (scrim is z-40, chip becomes z-50).
  return (
    <span className={`relative block min-w-0 ${open ? "z-50" : ""}`}>
      {!open ? (
        <div className={cardClass}>
          <button
            type="button"
            onClick={openMenu}
            aria-haspopup="listbox"
            aria-expanded={false}
            className="w-full text-left bg-transparent outline-none"
          >
            {header}
            <div className={`text-sm leading-tight truncate ${
              isSet ? "text-ink font-medium" : "text-muted italic"
            }`}>
              {display}
            </div>
          </button>
          {hasWarning && (
            <div className="mt-1.5 pt-1.5 border-t border-accent/30 flex items-center justify-between gap-2">
              <span className="text-[10.5px] text-accent italic leading-tight">
                {warning.reason}
              </span>
              {warning.suggestSlot && onMoveTo && (
                <button
                  type="button"
                  onClick={() => onMoveTo(warning.suggestSlot)}
                  className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-accent hover:underline flex-shrink-0"
                >
                  Move →
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={cardClass}>
          {header}
          {/* Multi mode: show the joined picks above the input as a
              hint so the teacher always sees what's selected. */}
          {multi && currentMulti.length > 0 && (
            <div className="text-sm text-ink font-medium leading-tight truncate mb-1">
              {joinMulti(currentMulti)}
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            inputMode={numeric ? "numeric" : undefined}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (multi) addCustomMulti(draft);
                else commit(draft);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            placeholder={
              multi
                ? currentMulti.length > 0 ? t("studio.combo.addAnother") : (emptyHint || t("studio.combo.pickOrType"))
                : (emptyHint || t("studio.combo.pickOrType"))
            }
            className="w-full bg-transparent outline-none text-sm text-ink leading-tight placeholder:text-muted placeholder:italic placeholder:font-normal"
          />
        </div>
      )}

      {open && (
        <ComboboxMenu
          label={label}
          value={value}
          draft={draft}
          options={filteredOptions}
          allOptions={options}
          suffix={suffix}
          multi={multi}
          currentMulti={currentMulti}
          onPick={commit}
          onToggle={toggleMulti}
          onAddCustom={addCustomMulti}
          onClose={() => (multi ? setOpen(false) : commit(draft))}
        />
      )}
    </span>
  );
}

// Filtered menu that opens under a DropdownChip. Shows two regions:
//   1. "Use \"<draft>\" (custom)" — when the draft text doesn't match
//      any preset; lets the teacher commit (single) or append (multi)
//      a free-form value.
//   2. The filtered preset options.
// There is no "let Murchid choose" / clear option: every chip is required,
// so the teacher always lands on a concrete value.
// In multi mode, clicking an option toggles it in the joined value
// without closing the menu; "Done" at the bottom closes.

export function ComboboxMenu({
  label, value, draft, options, allOptions, suffix,
  onPick, onClose,
  multi, currentMulti = [], onToggle, onAddCustom,
}) {
  const t = useT();
  // Explicit "Add new" popup — a clearer affordance than type-to-add for
  // teachers who don't realise the field is also a text input.
  const [addOpen, setAddOpen] = useState(false);
  const trimmed = String(draft || "").trim();
  const isCustom =
    trimmed.length > 0 &&
    !allOptions.some((o) => String(o).toLowerCase() === trimmed.toLowerCase());
  const isSelected = (opt) =>
    multi
      ? currentMulti.some((x) => String(x).toLowerCase() === String(opt).toLowerCase())
      : String(opt) === String(value);

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-transparent cursor-default"
      />
      <div
        role="listbox"
        onClick={(e) => e.stopPropagation()}
        className="studio-menu-rise absolute left-0 top-full mt-1.5 z-50 min-w-[14rem] max-h-[60vh] overflow-y-auto origin-top-left rounded-2xl border border-line bg-paper-cool shadow-xl ring-1 ring-ink/5"
      >
        <ul className="py-1">
          {isCustom && (
            <>
              <li>
                <button
                  type="button"
                  onClick={() => multi ? onAddCustom(trimmed) : onPick(trimmed)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink hover:bg-paper-warm/60"
                >
                  <span className="truncate">
                    {multi ? t("studio.combo.add") : t("studio.combo.use")}
                    <span className="font-medium">&ldquo;{trimmed}&rdquo;</span>
                    <span className="text-muted ml-1.5 text-[11px] italic">{t("studio.combo.custom")}</span>
                  </span>
                  <Plus size={13} className="text-accent flex-shrink-0" />
                </button>
              </li>
              <li className="border-t border-line/60 my-1" />
            </>
          )}

          {options.length === 0 && !isCustom && (
            <li className="px-3 py-2 text-sm text-muted italic">{t("studio.combo.noMatches")}</li>
          )}

          {options.map((opt) => {
            const isActive = isSelected(opt);
            return (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => (multi ? onToggle(opt) : onPick(opt))}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-100 ${
                    isActive
                      ? "bg-paper-warm text-ink font-medium"
                      : "text-ink hover:bg-paper-warm/60"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {multi && (
                      <span className={`inline-flex items-center justify-center h-4 w-4 rounded border ${
                        isActive
                          ? "bg-accent border-accent text-paper-cool"
                          : "border-line bg-paper"
                      }`}>
                        {isActive && <Check size={10} strokeWidth={3} />}
                      </span>
                    )}
                    <span>
                      {opt}
                      {suffix && <span className="text-muted ml-1">{suffix}</span>}
                    </span>
                  </span>
                  {!multi && isActive && <Check size={13} className="text-accent" />}
                </button>
              </li>
            );
          })}
          <li className="border-t border-line/60 mt-1 pt-1">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-accent hover:bg-paper-warm/60"
            >
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-accent/15">
                <Plus size={11} strokeWidth={2.5} />
              </span>
              {t("studio.combo.addNew")}
            </button>
          </li>
        </ul>
        {multi && (
          <div className="border-t border-line/60 px-2 py-2 flex items-center justify-between gap-2 bg-paper">
            <span className="font-serif italic text-xs text-muted px-1">
              {currentMulti.length === 0
                ? t("studio.combo.multiHint")
                : `${currentMulti.length} selected`}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink hover:text-accent px-2 py-1"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {addOpen && (
        <AddChipValuePopup
          label={label}
          onCancel={() => setAddOpen(false)}
          onAdd={(v) => {
            setAddOpen(false);
            if (multi) onAddCustom(v);
            else onPick(v);
          }}
        />
      )}
    </>
  );
}

// Small centered popup for adding a brand-new chip value. Opened from the
// "Add new" row inside ComboboxMenu so the affordance is explicit (vs.
// the subtler type-to-add). Esc / backdrop / Cancel all dismiss.

export const looksLikeGrade = (v) =>
  /grade\s*\d/i.test(v) ||
  /^kg\b/i.test(v) ||
  /^year\s*\d/i.test(v) ||
  /^form\s*\d/i.test(v);

export const looksLikeDifficulty = (v) =>
  /^(easy|medium|hard|beginner|intermediate|advanced|mixed)$/i.test(v.trim());

export const looksLikeMajor = (v) =>
  MAJORS.some((m) => m.toLowerCase() === v.trim().toLowerCase());

export const looksLikeInteger = (v) => /^\d+$/.test(String(v).trim());

// Per-kind required selections. The teacher must set every one of these
// before Studio will generate — no nulls, no "Murchid guesses the basics".
// The ONLY field allowed to stay empty is the schedule-for date (the
// teacher may decide when to run it later). The instruction line isn't
// listed because it always carries a mode ("none" by default), never null.

export const splitMulti = (s) =>
  String(s || "").split(",").map((t) => t.trim()).filter(Boolean);

export const joinMulti = (arr) => arr.filter(Boolean).join(", ");

// Render an ISO date (YYYY-MM-DD or a full timestamp) as a short, human
// label for the cover. Locale-aware; falls back to the raw value if parse
// fails so we never show an empty cell for a malformed date.

export function AddChipValuePopup({ label, onCancel, onAdd }) {
  const t = useT();
  const [val, setVal] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.focus(), 0);
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(id); window.removeEventListener("keydown", onKey); };
  }, [onCancel]);
  const submit = () => {
    const v = val.trim();
    if (v) onAdd(v);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="studio-menu-rise relative bg-paper-cool rounded-2xl border border-line shadow-2xl w-full max-w-sm p-5">
        <p className="font-serif italic text-base text-accent mb-2">
          {t("studio.combo.addNewTitle", { label: label || "" })}
        </p>
        <input
          ref={ref}
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={t("studio.combo.addNewPh")}
          className="w-full px-3.5 py-2.5 rounded-lg border border-line bg-paper text-sm text-ink outline-none focus:border-accent transition-all"
        />
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} className="text-sm px-4 py-2">
            {t("studio.combo.cancel")}
          </Button>
          <Button onClick={submit} disabled={!val.trim()} className="text-sm px-4 py-2">
            <Plus size={14} className="mr-1.5" />
            {t("studio.combo.addNewBtn")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Save-time confirmation. Surfaced only when the teacher edited at least
// one correct_answer pre-save. Lists each changed question (was → now)
// Warn the teacher when their free-text prompt mentions a Grade /
// Duration / Slides / Questions value that disagrees with the chip
// value above. "Use settings" makes the chips authoritative on this
// generation; "Edit" closes the modal so they can fix the prompt.

export function HelpTip({ text }) {
  const [open, setOpen] = useState(false);
  const { dir } = useI18n();
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      aria-label={`Help: ${text}`}
    >
      <HelpCircle
        size={11}
        strokeWidth={1.75}
        className={`cursor-help transition-colors duration-150 ${
          open ? "text-accent" : "text-muted/80 hover:text-accent"
        }`}
      />
      {open && (
        <span
          role="tooltip"
          dir={dir}
          className="studio-helptip absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-60 px-3 py-2.5 rounded-lg bg-ink text-paper-cool text-[11px] leading-relaxed shadow-xl pointer-events-none normal-case tracking-normal font-sans font-normal text-start"
        >
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-ink" />
          {text}
        </span>
      )}
    </span>
  );
}
