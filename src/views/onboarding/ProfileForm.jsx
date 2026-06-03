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
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Check, Download, Upload, FileText, X, Plus, MapPin, Search, Star, Trash2, Layers, RotateCcw } from "lucide-react";
import { MAJORS, GRADE_LEVELS, QUIZ_LANGUAGES, QUIZ_SECTIONS } from "../../lib/enums";
import { EMIRATES } from "../../lib/schools";
import {
  setPendingProfile, getPendingProfile,
  setPendingStudents, getPendingStudents,
  setPendingSchools, getPendingSchools,
} from "../../lib/account";
import { useT, useI18n } from "../../lib/i18n";
import Avatar from "../../components/Avatar";
import { avatarsFor } from "../../lib/avatars";
import { api } from "../_shared";

const STEPS = ["identity", "subjects", "scope", "schools", "students"];

const EMPTY = {
  firstName: "",
  lastName: "",
  staffId: "",
  gender: "",
  avatar: "",
  bio: "",
  majors: [],
  languages: [],
  grades: [],
  // Per-grade sections — { "Grade 3": ["Section A", "Section B"], ... }.
  // The flat `sections` field below is kept as the union of all values
  // so legacy Studio dropdowns and the teaching-profile editor that
  // still read a flat list keep working without a migration.
  gradeSections: {},
  sections: [],
};

// CSV columns the teacher's roster template uses. Order matters — we
// parse positionally so the template's header row is for human eyes,
// not for column-matching. Optional columns can be left blank.
const STUDENT_COLUMNS = [
  "first_name",   // required
  "last_name",    // required
  "grade",        // required, free-text (matches GRADE_LEVELS)
  "section",      // optional
  "student_id",   // optional
  "parent_email", // optional
];

const TEMPLATE_ROWS = [
  ["Aisha",    "Al Mansoori", "Grade 6", "A", "S-101", "parent.almansoori@example.com"],
  ["Khalid",   "Hassan",      "Grade 6", "A", "S-102", "parent.hassan@example.com"],
  ["",         "",            "",        "",  "",      ""],
];

function escapeCsvCell(v) {
  const s = String(v ?? "");
  // Quote when the cell has comma, quote, or newline.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function rowsToCsv(headers, rows) {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const r of rows) lines.push(r.map(escapeCsvCell).join(","));
  return lines.join("\r\n");
}
function downloadCsv(filename, csv) {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }); // BOM so Excel sees UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Minimal CSV parser — handles quoted cells, escaped quotes ("") and
// CR/LF line endings. Skips the header row.
function parseCsv(text) {
  const cleaned = text.replace(/^﻿/, ""); // strip BOM
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inQuotes) {
      if (c === '"' && cleaned[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\r") { /* swallow */ }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else { cell += c; }
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}
function parseStudentsCsv(text) {
  const rows = parseCsv(text);
  if (rows.length <= 1) return [];
  return rows.slice(1)
    .map((r) => ({
      firstName:   (r[0] || "").trim(),
      lastName:    (r[1] || "").trim(),
      grade:       (r[2] || "").trim(),
      section:     (r[3] || "").trim(),
      studentId:   (r[4] || "").trim(),
      parentEmail: (r[5] || "").trim(),
    }))
    .filter((s) => s.firstName && s.lastName);
}

export default function ProfileForm({ onDone, onBack }) {
  const t = useT();
  const { dir } = useI18n();
  const [stepIdx, setStepIdx] = useState(0);
  const [data, setData] = useState(() => ({ ...EMPTY, ...(getPendingProfile() || {}) }));
  const [students, setStudents] = useState(() => getPendingStudents() || []);
  // schools: [{ school_id, name, name_ar, emirate, city, is_primary }]. Saved
  // on next/finish via setPendingSchools so the choice survives the plan picker.
  const [schools, setSchools] = useState(() => getPendingSchools() || []);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  const step = STEPS[stepIdx];
  const last = stepIdx === STEPS.length - 1;

  // Lightweight per-step validation — staff_id, bio, sections, and
  // the entire students step are optional; the rest must have
  // something so we don't end up with an empty teacher profile.
  // Every field is required to advance — only the bio (and the
  // skippable schools/students steps) get to be empty.
  const valid =
    step === "identity"
      ? data.firstName.trim().length > 0 &&
        data.lastName.trim().length > 0 &&
        data.staffId.trim().length > 0 &&
        data.gender.length > 0 &&
        data.avatar.length > 0
      : step === "subjects"
        ? data.majors.length > 0 && data.languages.length > 0
        : step === "scope"
          // Every picked grade must have at least one section. Empty
          // grades shouldn't be allowed past — that's the whole point
          // of the per-grade picker.
          ? data.grades.length > 0 &&
            data.grades.every((g) => (data.gradeSections?.[g] || []).length > 0)
          : step === "schools"
            ? schools.length > 0
            : true; // students step — always valid (skippable)

  const handleTemplateDownload = () => {
    const csv = rowsToCsv(STUDENT_COLUMNS, TEMPLATE_ROWS);
    downloadCsv("murchid-students-template.csv", csv);
  };
  const handleFile = (file) => {
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const parsed = parseStudentsCsv(text);
        if (parsed.length === 0) {
          setImportError(t("onb.students.errEmpty"));
          return;
        }
        setStudents(parsed);
      } catch {
        setImportError(t("onb.students.errParse"));
      }
    };
    reader.onerror = () => setImportError(t("onb.students.errParse"));
    reader.readAsText(file);
  };

  const set = (patch) => setData((d) => ({ ...d, ...patch }));
  // Switching gender swaps the avatar set, so drop any avatar that
  // belonged to the previous set — otherwise the picker would show a
  // selected ring with no matching tile.
  const setGender = (g) =>
    setData((d) => ({
      ...d,
      gender: g,
      avatar: avatarsFor(g).some((a) => a.id === d.avatar) ? d.avatar : "",
    }));
  const toggleIn = (key, value) =>
    setData((d) => {
      const cur = d[key] || [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...d, [key]: next };
    });

  // Grade picker tracks BOTH the grades array AND the per-grade section
  // map (gradeSections). When a grade is deselected, drop its sections;
  // when re-selected, start it empty so the teacher picks fresh. The
  // flat sections field stays as the union of all values for legacy
  // consumers (Studio dropdowns, useTeacherClasses, etc).
  const unionOfGradeSections = (gs) => {
    const u = new Set();
    for (const arr of Object.values(gs || {})) for (const s of arr) u.add(s);
    return [...u];
  };
  const toggleGrade = (grade) =>
    setData((d) => {
      const on = d.grades.includes(grade);
      if (on) {
        const grades = d.grades.filter((g) => g !== grade);
        const gradeSections = { ...(d.gradeSections || {}) };
        delete gradeSections[grade];
        return { ...d, grades, gradeSections, sections: unionOfGradeSections(gradeSections) };
      }
      return { ...d, grades: [...d.grades, grade] };
    });
  const setAllGrades = (next) =>
    setData((d) => {
      if (next.length === 0) {
        return { ...d, grades: [], gradeSections: {}, sections: [] };
      }
      // Carry over sections only for grades that remain selected.
      const gradeSections = {};
      for (const g of next) if (d.gradeSections?.[g]) gradeSections[g] = d.gradeSections[g];
      return { ...d, grades: next, gradeSections, sections: unionOfGradeSections(gradeSections) };
    });
  const setSectionsForGrade = (grade, sections) =>
    setData((d) => {
      const gradeSections = { ...(d.gradeSections || {}), [grade]: sections };
      return { ...d, gradeSections, sections: unionOfGradeSections(gradeSections) };
    });

  const next = () => {
    if (!valid) return;
    // Persist the in-progress picks on every step so a closed-tab resume
    // doesn't lose the schools array.
    setPendingSchools(schools);
    if (last) {
      setPendingProfile(data);
      setPendingStudents(students);
      onDone?.({ ...data, students, schools });
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
          <div className="space-y-6">
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
            <Field label={t("onb.fld.staffId")} required>
              <input
                type="text"
                value={data.staffId}
                onChange={(e) => set({ staffId: e.target.value })}
                className="onb-input"
                placeholder={t("onb.ph.staffId")}
              />
            </Field>
          </div>
          <Field label={t("onb.fld.gender")} required>
            <div className="flex gap-2">
              {["man", "woman"].map((g) => {
                const on = data.gender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(on ? "" : g)}
                    aria-pressed={on}
                    className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
                      on
                        ? "bg-ink text-paper-cool border-ink"
                        : "bg-paper-cool text-ink border-line hover:border-ink"
                    }`}
                  >
                    {t(`onb.gender.${g}`)}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t("onb.fld.avatar")} required>
            <div className="flex flex-wrap gap-3">
              {avatarsFor(data.gender).map((a) => {
                const on = data.avatar === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => set({ avatar: on ? "" : a.id })}
                    aria-pressed={on}
                    aria-label="Choose avatar"
                    style={{
                      padding: 0,
                      border: 0,
                      background: "none",
                      cursor: "pointer",
                      borderRadius: "50%",
                      lineHeight: 0,
                      transition: "box-shadow 150ms, transform 150ms",
                      boxShadow: on
                        ? "0 0 0 3px var(--clay)"
                        : "0 0 0 1px var(--line-strong)",
                      transform: on ? "scale(1.05)" : "none",
                    }}
                  >
                    <Avatar avatarId={a.id} size={56} />
                  </button>
                );
              })}
            </div>
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
                onSetAll={(next) => set({ majors: next })}
                allLabel={t("onb.all.majors")}
              />
            </Field>
            <Field label={t("onb.fld.languages")} required>
              <ChipPicker
                options={QUIZ_LANGUAGES}
                selected={data.languages}
                onToggle={(v) => toggleIn("languages", v)}
                onSetAll={(next) => set({ languages: next })}
                allLabel={t("onb.all.languages")}
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
                onToggle={(v) => toggleGrade(v)}
                onSetAll={(next) => setAllGrades(next)}
                allLabel={t("onb.all.grades")}
              />
            </Field>

            {/* Per-grade section picker. Renders one row per selected
                grade so the teacher can say "Grade 3 → A + B, Grade 4
                → C + B" instead of one flat list that doesn't tie to
                any grade. The flat data.sections array is kept as the
                union of all rows so downstream legacy dropdowns
                (Studio quiz / homework / etc.) still work. */}
            {data.grades.length > 0 && (
              <div>
                <p className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
                  {t("onb.fld.sectionsPerGrade")}
                  <span style={{ color: "var(--clay)" }}> *</span>
                </p>
                <p className="text-[11.5px] mt-1 mb-3" style={{ color: "var(--ink-3)" }}>
                  {t("onb.fld.sectionsPerGrade.lead")}
                </p>
                <div className="space-y-3">
                  {data.grades.map((g) => (
                    <GradeSectionRow
                      key={g}
                      grade={g}
                      sections={data.gradeSections?.[g] || []}
                      onChange={(next) => setSectionsForGrade(g, next)}
                    />
                  ))}
                </div>
              </div>
            )}

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

        {step === "schools" && (
          <SchoolsStep
            t={t}
            value={schools}
            onChange={setSchools}
            grades={data.grades}
            gradeSections={data.gradeSections}
          />
        )}

        {step === "students" && (
          <div className="space-y-5">
            {/* Three numbered steps — keeps the flow obvious for
                non-technical teachers. Steps 1 and 3 carry their
                action buttons inline so the order matches the
                reading order. Step 2 is just text. */}
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 inline-flex h-7 w-7 rounded-full bg-accent text-paper-cool font-mono text-[12px] font-semibold items-center justify-center">
                  1
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink leading-tight">
                    {t("onb.students.s1.title")}
                  </p>
                  <p className="text-[12.5px] text-muted leading-snug mt-0.5 mb-2">
                    {t("onb.students.s1.body")}
                  </p>
                  <button
                    type="button"
                    onClick={handleTemplateDownload}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-line bg-paper-cool hover:border-ink/40 transition-colors text-[13px] font-medium text-ink"
                  >
                    <Download size={14} className="text-accent" />
                    {t("onb.students.s1.btn")}
                  </button>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 inline-flex h-7 w-7 rounded-full bg-accent text-paper-cool font-mono text-[12px] font-semibold items-center justify-center">
                  2
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink leading-tight">
                    {t("onb.students.s2.title")}
                  </p>
                  <p className="text-[12.5px] text-muted leading-snug mt-0.5">
                    {t("onb.students.s2.body")}
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 inline-flex h-7 w-7 rounded-full bg-accent text-paper-cool font-mono text-[12px] font-semibold items-center justify-center">
                  3
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink leading-tight">
                    {t("onb.students.s3.title")}
                  </p>
                  <p className="text-[12.5px] text-muted leading-snug mt-0.5 mb-2">
                    {t("onb.students.s3.body")}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-line bg-paper-cool hover:border-ink/40 transition-colors text-[13px] font-medium text-ink"
                  >
                    <Upload size={14} className="text-ink" />
                    {t("onb.students.s3.btn")}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                    className="hidden"
                  />
                </div>
              </li>
            </ol>

            {importError && (
              <p className="text-[12.5px] text-accent">{importError}</p>
            )}

            {students.length > 0 && (
              <div className="rounded-xl border border-sage/40 bg-sage/[0.06] overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-sage/30">
                  <div className="flex items-center gap-2 text-[13px] text-ink">
                    <FileText size={14} className="text-sage" />
                    <span className="font-medium">
                      {t("onb.students.parsed", { n: students.length })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setStudents([]); setImportError(null); }}
                    className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-ink transition-colors"
                  >
                    <X size={12} /> {t("onb.students.clear")}
                  </button>
                </div>
                <ul className="max-h-[160px] overflow-y-auto divide-y divide-sage/20">
                  {students.slice(0, 6).map((s, i) => (
                    <li key={i} className="px-4 py-2 text-[12.5px] flex items-center gap-2">
                      <span className="font-medium text-ink truncate">
                        {s.firstName} {s.lastName}
                      </span>
                      <span className="text-muted flex-shrink-0">
                        · {s.grade}{s.section ? ` ${s.section}` : ""}
                      </span>
                    </li>
                  ))}
                  {students.length > 6 && (
                    <li className="px-4 py-2 text-[11.5px] italic text-muted">
                      +{students.length - 6} {t("onb.students.more")}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-10 flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-paper-warm"
            style={{ color: "var(--ink)" }}
          >
            <ChevronLeft size={16} className="rtl:rotate-180" />
            {stepIdx === 0 ? t("onb.back.signin") : t("onb.back.step")}
          </button>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={next}
              disabled={!valid}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {last ? t("onb.finish") : t("onb.next")}
              {last ? <Check size={16} /> : <ChevronRight size={16} className="rtl:rotate-180" />}
            </button>
            {/* Skip — italic text link with permanent underline, centered
                directly under the primary Continue button. Standard
                pattern: low-commitment exit beneath the primary CTA. */}
            {step === "schools" && (
              <button
                type="button"
                onClick={() => {
                  // Bypass — same shape as the students skip. Wipe any
                  // half-picked schools and advance to the next step.
                  setSchools([]);
                  setPendingSchools([]);
                  setStepIdx((i) => i + 1);
                }}
                className="font-serif italic text-sm text-ink-soft hover:text-ink underline underline-offset-2 transition-colors"
              >
                {t("onb.schools.skipBtn")}
              </button>
            )}
            {step === "students" && (
              <button
                type="button"
                onClick={() => {
                  setStudents([]);
                  setImportError(null);
                  setPendingProfile(data);
                  setPendingStudents([]);
                  onDone?.({ ...data, students: [], schools });
                }}
                className="font-serif italic text-sm text-ink-soft hover:text-ink underline underline-offset-2 transition-colors"
              >
                {t("onb.students.skipBtn")}
              </button>
            )}
          </div>
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

// Field used to be a <label> — that meant a click in the empty space
// between chips bubbled to the label and toggled the first chip
// underneath it (KG 1 for the grades row, Section A for sections).
// A plain <div> avoids the label's "click anywhere to activate the
// first focusable child" behaviour. Text inputs don't need the label
// wrapper to be functional.
function Field({ label, hint, required, children }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>
          {label}
          {required && <span style={{ color: "var(--clay)" }}> *</span>}
        </span>
        {hint && (
          <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ChipPicker({
  options, selected, onToggle, onSetAll, allLabel,
  onAdd, addPlaceholder, addButtonLabel,
}) {
  // Render the predefined options PLUS any custom items already in
  // `selected` (so a teacher who added "Maths Track" still sees it).
  // Custom chips toggle off the same way as predefined ones — clicking
  // an unselected custom chip re-adds it through onToggle.
  const allOptions = useMemo(() => {
    const seen = new Set(options);
    const extras = selected.filter((v) => !seen.has(v));
    return [...options, ...extras];
  }, [options, selected]);

  const allOn = onSetAll && options.every((o) => selected.includes(o));
  const [draft, setDraft] = useState("");
  const handleAdd = () => {
    const v = draft.trim();
    if (!v) return;
    // Only push if it's not already selected, so adding a duplicate is a no-op.
    if (!selected.includes(v)) onAdd?.(v);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {onSetAll && (
          <button
            type="button"
            onClick={() => onSetAll(allOn ? [] : [...options])}
            aria-pressed={allOn}
            className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${
              allOn
                ? "bg-accent text-paper-cool border-accent"
                : "bg-paper-cool text-accent border-accent hover:bg-accent/10"
            }`}
          >
            {allLabel}
          </button>
        )}
        {allOptions.map((opt) => {
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
      {onAdd && (
        <div className="flex items-center gap-2 max-w-sm">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder={addPlaceholder}
            className="onb-input flex-1 !py-1.5 !text-[12.5px]"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-paper-cool text-[12.5px] font-medium text-ink hover:border-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={12} />
            {addButtonLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// SchoolsStep
// ─────────────────────────────────────────────────────────────────────────
// Fetches the UAE catalog from /api/schools on mount, then renders a
// searchable list filtered by emirate. The teacher's selections are
// kept in the parent (so they survive Back/Next), shaped as:
//   [{ school_id, name, name_ar, emirate, city, is_primary }, ...]
//
// The first added school is auto-marked primary. The "Make primary"
// chip on each row demotes the others — there's at most one primary.
//
// A "School not listed?" fallback at the bottom lets a teacher type a
// custom name; the picked emirate is used. Custom schools get a
// negative pseudo-id (–Date.now()) — the Landing plan-pick handler
// POSTs them to /api/schools first to create real catalog rows, then
// attaches them via /api/schools/mine.
function SchoolsStep({ t, value, onChange, grades, gradeSections }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [emirateFilter, setEmirateFilter] = useState("");
  const [customName, setCustomName] = useState("");
  const [customEmirate, setCustomEmirate] = useState("Dubai");
  // Which school's per-school grade override panel is currently open.
  // null = all collapsed. Only one open at a time keeps the list tidy.
  const [expandedSchool, setExpandedSchool] = useState(null);

  useEffect(() => {
    api("/api/schools")
      .then((rows) => {
        setCatalog(rows || []);
        setLoading(false);
      })
      .catch((e) => {
        setLoadError(e.message);
        setLoading(false);
      });
  }, []);

  const selectedIds = useMemo(() => new Set(value.map((s) => s.school_id)), [value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((s) => {
      if (emirateFilter && s.emirate !== emirateFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.name_ar || "").includes(q) ||
        (s.city || "").toLowerCase().includes(q) ||
        s.emirate.toLowerCase().includes(q)
      );
    }).slice(0, 40); // cap to keep the list scannable
  }, [catalog, search, emirateFilter]);

  const addSchool = (s) => {
    if (selectedIds.has(s.id)) return;
    const next = [
      ...value,
      {
        school_id: s.id,
        name: s.name,
        name_ar: s.name_ar,
        emirate: s.emirate,
        city: s.city,
        is_primary: value.length === 0, // first one is the primary by default
      },
    ];
    onChange(next);
  };
  const removeSchool = (school_id) => {
    let next = value.filter((s) => s.school_id !== school_id);
    // If we just removed the primary, promote the first remaining one.
    if (next.length > 0 && !next.some((s) => s.is_primary)) {
      next = next.map((s, i) => (i === 0 ? { ...s, is_primary: true } : s));
    }
    onChange(next);
  };
  const makePrimary = (school_id) => {
    onChange(value.map((s) => ({ ...s, is_primary: s.school_id === school_id })));
  };

  // Per-school grade-sections override. Setting school.gradeSections
  // pins this school to its own map; clearing it (resetSchool…) lets
  // the school inherit the global `gradeSections` from step 3 again.
  // Toggling a single (grade, section) is the common case during
  // onboarding — flips the section in/out of the array.
  const toggleSchoolSection = (school_id, grade, section) => {
    onChange(value.map((s) => {
      if (s.school_id !== school_id) return s;
      const current = (s.gradeSections && s.gradeSections[grade])
        || (gradeSections && gradeSections[grade])
        || [];
      const next = current.includes(section)
        ? current.filter((x) => x !== section)
        : [...current, section];
      // Persist the override even if it equals the inherited shape —
      // the user explicitly customized, and the explicit copy is what
      // Landing's plan-pick handler sends to /api/schools/mine.
      const baseMap = s.gradeSections
        ? { ...s.gradeSections }
        : { ...(gradeSections || {}) };
      baseMap[grade] = next;
      return { ...s, gradeSections: baseMap };
    }));
  };
  const resetSchoolGradeSections = (school_id) => {
    onChange(value.map((s) => {
      if (s.school_id !== school_id) return s;
      const { gradeSections: _drop, ...rest } = s;
      return rest;
    }));
  };
  // Returns the effective grade→sections map for a given school —
  // either its override or the global inherited map.
  const effectiveFor = (s) =>
    (s.gradeSections && Object.keys(s.gradeSections).length > 0)
      ? s.gradeSections
      : (gradeSections || {});
  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    // Negative pseudo-ids: the Landing plan-pick handler swaps these
    // out for real catalog ids once /api/schools accepts an insert.
    const pseudoId = -Date.now();
    onChange([
      ...value,
      {
        school_id: pseudoId,
        name,
        name_ar: null,
        emirate: customEmirate,
        city: null,
        is_primary: value.length === 0,
        _custom: true,
      },
    ]);
    setCustomName("");
  };

  // Step 3 (scope) picked grades + per-grade sections; Landing's
  // plan-pick handler attaches them to every school below. Surface that
  // here so teachers don't wonder whether the data carries over.
  const pickedGrades = Array.isArray(grades) ? grades : [];
  const sectionsMap = gradeSections || {};

  return (
    <div className="space-y-5">
      {/* Inheritance banner — shows what'll be linked to every school
          the teacher picks below. Editable per-school later in Settings. */}
      <div className="rounded-xl border border-clay/30 bg-clay/[0.05] p-3.5 sm:p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-clay mb-2 inline-flex items-center gap-2">
          <Layers size={11} strokeWidth={2.25} />
          {t("onb.schools.inherit.eyebrow")}
        </p>
        <p className="text-[13.5px] font-medium text-ink mb-2">
          {t("onb.schools.inherit.title")}
        </p>
        {pickedGrades.length === 0 ? (
          <p className="text-[12.5px] text-muted italic">
            {t("onb.schools.inherit.empty")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {pickedGrades.map((g) => {
              const secs = sectionsMap[g] || [];
              return (
                <li key={g} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12.5px]">
                  <span className="font-medium text-ink">{g}</span>
                  {secs.length === 0 ? (
                    <span className="text-muted italic">
                      · {t("onb.schools.inherit.noSections")}
                    </span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {secs.map((s) => (
                        <span
                          key={s}
                          className="px-1.5 py-[1px] rounded-full bg-paper-cool border border-line/70 text-[11px] text-ink"
                        >
                          {s}
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-muted mt-2.5">
          {t("onb.schools.inherit.hintWithCustom")}
        </p>
      </div>

      {/* Selected pills — sits ABOVE the picker so the teacher sees
          what they've already added and doesn't add the same school twice. */}
      {value.length > 0 && (
        <div className="rounded-xl border border-sage/40 bg-sage/[0.06] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2">
            <MapPin size={11} className="text-sage" />
            {t("onb.schools.selected")} · {value.length}
          </p>
          <ul className="space-y-1.5">
            {value.map((s) => {
              const isExpanded = expandedSchool === s.school_id;
              const isCustomized = !!(s.gradeSections && Object.keys(s.gradeSections).length > 0);
              const effective = effectiveFor(s);
              const hasGrades = pickedGrades.length > 0;
              return (
                <li
                  key={s.school_id}
                  className="rounded-lg bg-paper-cool border border-line/70"
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink truncate">
                        {s.name}
                        {s.is_primary && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-[1px] rounded-full bg-clay/15 text-clay text-[10px] font-mono uppercase tracking-wider">
                            <Star size={9} fill="currentColor" /> {t("onb.schools.primary")}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted truncate">
                        {s.emirate}{s.city ? ` · ${s.city}` : ""}
                      </p>
                    </div>
                    {!s.is_primary && value.length > 1 && (
                      <button
                        type="button"
                        onClick={() => makePrimary(s.school_id)}
                        title={t("onb.schools.makePrimary")}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-clay hover:bg-clay/10 transition-colors"
                      >
                        <Star size={11} />
                        {t("onb.schools.makePrimary")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeSchool(s.school_id)}
                      title={t("onb.schools.remove")}
                      aria-label={t("onb.schools.remove")}
                      className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-soft hover:bg-accent hover:text-paper-cool transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {/* Per-school grade override toggle. Hidden when the
                      teacher hasn't picked any grades in step 3 yet —
                      nothing to customize. */}
                  {hasGrades && (
                    <button
                      type="button"
                      onClick={() => setExpandedSchool(isExpanded ? null : s.school_id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 border-t border-line/60 text-[11.5px] text-ink-soft hover:bg-paper/40 transition-colors"
                      aria-expanded={isExpanded}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {t("onb.schools.custom.toggle")}
                        {isCustomized && (
                          <span className="ms-1 px-1.5 py-[1px] rounded-full bg-clay/12 text-clay text-[9.5px] font-mono uppercase tracking-wider">
                            {t("onb.schools.custom.badge")}
                          </span>
                        )}
                      </span>
                      <span className="text-muted">
                        {isCustomized
                          ? t("onb.schools.custom.statusCustom")
                          : t("onb.schools.custom.statusInherit")}
                      </span>
                    </button>
                  )}
                  {hasGrades && isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-line/40 bg-paper/40 space-y-2">
                      <p className="text-[11px] text-muted">
                        {t("onb.schools.custom.hint")}
                      </p>
                      <ul className="space-y-1.5">
                        {pickedGrades.map((g) => {
                          const inheritedSecs = (gradeSections && gradeSections[g]) || [];
                          const activeSecs = effective[g] || [];
                          if (inheritedSecs.length === 0) {
                            return (
                              <li key={g} className="text-[12px] flex flex-wrap items-baseline gap-x-2">
                                <span className="font-medium text-ink">{g}</span>
                                <span className="text-muted italic text-[11px]">
                                  {t("onb.schools.inherit.noSections")}
                                </span>
                              </li>
                            );
                          }
                          return (
                            <li key={g} className="text-[12px]">
                              <p className="font-medium text-ink mb-1">{g}</p>
                              <div className="flex flex-wrap gap-1.5 ps-1">
                                {inheritedSecs.map((sec) => {
                                  const on = activeSecs.includes(sec);
                                  return (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => toggleSchoolSection(s.school_id, g, sec)}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-medium transition-colors ${
                                        on
                                          ? "bg-sage/15 text-sage border-sage/40"
                                          : "bg-paper-cool text-muted border-line hover:border-ink-soft"
                                      }`}
                                      aria-pressed={on}
                                    >
                                      {on ? <Check size={10} /> : <Plus size={10} />}
                                      {sec}
                                    </button>
                                  );
                                })}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {isCustomized && (
                        <button
                          type="button"
                          onClick={() => resetSchoolGradeSections(s.school_id)}
                          className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft hover:text-clay transition-colors mt-1"
                        >
                          <RotateCcw size={11} />
                          {t("onb.schools.custom.reset")}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Search + emirate filter */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search size={18} strokeWidth={2.25} className="absolute top-1/2 -translate-y-1/2 left-4 text-ink-soft pointer-events-none rtl:left-auto rtl:right-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("onb.schools.search.ph")}
            className="w-full !pl-12 pr-4 py-3.5 rounded-xl border-2 border-[var(--line-strong,#d4c9b3)] bg-[#fffdf6] text-ink text-[16px] font-medium outline-none transition-all placeholder:text-muted placeholder:font-normal focus:border-clay focus:shadow-[0_0_0_4px_rgba(200,71,43,0.10)] rtl:!pl-4 rtl:!pr-12"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setEmirateFilter("")}
            className={`px-3 py-1 rounded-full text-[11.5px] font-medium border transition-colors ${
              emirateFilter === ""
                ? "bg-ink text-paper-cool border-ink"
                : "bg-paper-cool text-ink border-line hover:border-ink"
            }`}
          >
            {t("onb.schools.emirate.all")}
          </button>
          {EMIRATES.map((em) => {
            const on = emirateFilter === em;
            return (
              <button
                key={em}
                type="button"
                onClick={() => setEmirateFilter(on ? "" : em)}
                className={`px-3 py-1 rounded-full text-[11.5px] font-medium border transition-colors ${
                  on
                    ? "bg-ink text-paper-cool border-ink"
                    : "bg-paper-cool text-ink border-line hover:border-ink"
                }`}
              >
                {em}
              </button>
            );
          })}
        </div>
      </div>

      {/* Catalog list */}
      {loading ? (
        <p className="text-sm text-muted">Loading schools…</p>
      ) : loadError ? (
        <p className="text-sm text-accent">{loadError}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted italic">{t("onb.schools.empty")}</p>
      ) : (
        <ul className="max-h-[280px] overflow-y-auto rounded-xl border border-line divide-y divide-line/70">
          {filtered.map((s) => {
            const on = selectedIds.has(s.id);
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-ink truncate">{s.name}</p>
                  <p className="text-[11px] text-muted truncate">
                    {s.emirate}{s.city ? ` · ${s.city}` : ""}
                    {s.curriculum ? ` · ${s.curriculum}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addSchool(s)}
                  disabled={on}
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11.5px] font-medium border transition-colors ${
                    on
                      ? "bg-sage/15 text-sage border-sage/40 cursor-default"
                      : "bg-paper-cool text-ink border-line hover:border-ink"
                  }`}
                >
                  {on ? (
                    <><Check size={11} /> {t("onb.schools.added")}</>
                  ) : (
                    <><Plus size={11} /> {t("onb.schools.add")}</>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Fallback: school not in the list */}
      <div className="rounded-2xl border-2 border-dashed border-line bg-paper-cool/70 p-4 sm:p-5">
        <p className="text-[13.5px] font-medium text-ink mb-3 flex items-center gap-2">
          <Plus size={14} className="text-clay" strokeWidth={2.5} />
          {t("onb.schools.notListed")}
        </p>
        {/* Stacked layout: name input full-width on its own row,
            emirate + add button on a second row. Keeps the name field
            wide enough to type a real school name even on phones. */}
        <div className="space-y-2.5">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={t("onb.schools.notListed.ph")}
            className="w-full px-4 py-3 rounded-xl border-2 border-line bg-paper text-ink text-[15px] outline-none transition-all placeholder:text-muted focus:border-clay focus:shadow-[0_0_0_4px_rgba(200,71,43,0.10)]"
          />
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 min-w-0">
              <label className="block font-mono text-[9.5px] uppercase tracking-[0.15em] text-muted mb-1 ms-1">
                {t("onb.schools.notListed.emirate")}
              </label>
              <select
                value={customEmirate}
                onChange={(e) => setCustomEmirate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-line bg-paper text-ink text-[14px] outline-none transition-all focus:border-clay focus:shadow-[0_0_0_4px_rgba(200,71,43,0.10)]"
              >
                {EMIRATES.map((em) => (
                  <option key={em} value={em}>{em}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={addCustom}
              disabled={!customName.trim()}
              className="sm:self-end inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-ink text-paper-cool text-[13.5px] font-medium hover:bg-clay transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-ink"
            >
              <Plus size={14} strokeWidth={2.5} />
              {t("onb.schools.notListed.btn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// One row of the per-grade section picker. The teacher picks from the
// QUIZ_SECTIONS list OR types a custom section (e.g. "Honors", "Maths
// Track"); previously-picked customs are kept as chips so they can be
// re-selected later without re-typing.
function GradeSectionRow({ grade, sections, onChange }) {
  const [draft, setDraft] = useState("");
  const presets = QUIZ_SECTIONS.filter((s) => s !== "All sections");
  // Show presets + any customs the teacher already added (so they
  // remain visible when toggled off).
  const allOptions = useMemo(() => {
    const seen = new Set(presets);
    const extras = sections.filter((s) => !seen.has(s));
    return [...presets, ...extras];
  }, [presets, sections]);

  const toggle = (s) =>
    onChange(sections.includes(s) ? sections.filter((x) => x !== s) : [...sections, s]);
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!sections.includes(v)) onChange([...sections, v]);
    setDraft("");
  };

  const empty = sections.length === 0;

  return (
    <div className={`rounded-xl border p-3.5 transition-colors ${
      empty
        ? "border-clay/40 bg-clay/[0.04]"
        : "border-line bg-paper-cool/60"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink">
          {grade}
        </p>
        <span className={`text-[11px] ${empty ? "text-clay" : "text-muted"}`}>
          {empty
            ? "Pick at least one section"
            : `${sections.length} section${sections.length > 1 ? "s" : ""}`}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {allOptions.map((s) => {
          const on = sections.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
                on
                  ? "bg-ink text-paper-cool border-ink"
                  : "bg-paper text-ink border-line hover:border-ink"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 max-w-xs">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder="e.g. Honors, Maths Track"
          className="onb-input flex-1 !py-1.5 !text-[12.5px]"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-paper text-[12.5px] font-medium text-ink hover:border-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
    </div>
  );
}
