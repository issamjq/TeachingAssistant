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
import React, { useMemo, useRef, useState } from "react";
import { ChevronRight, ChevronLeft, Check, Download, Upload, FileText, X, Plus } from "lucide-react";
import { MAJORS, GRADE_LEVELS, QUIZ_LANGUAGES, QUIZ_SECTIONS } from "../../lib/enums";
import {
  setPendingProfile, getPendingProfile,
  setPendingStudents, getPendingStudents,
} from "../../lib/account";
import { useT, useI18n } from "../../lib/i18n";

const STEPS = ["identity", "subjects", "scope", "students"];

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
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  const step = STEPS[stepIdx];
  const last = stepIdx === STEPS.length - 1;

  // Lightweight per-step validation — staff_id, bio, sections, and
  // the entire students step are optional; the rest must have
  // something so we don't end up with an empty teacher profile.
  const valid =
    step === "identity"
      ? data.firstName.trim().length > 0 && data.lastName.trim().length > 0
      : step === "subjects"
        ? data.majors.length > 0 && data.languages.length > 0
        : step === "scope"
          ? data.grades.length > 0
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
      setPendingStudents(students);
      onDone?.({ ...data, students });
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
                onToggle={(v) => toggleIn("grades", v)}
                onSetAll={(next) => set({ grades: next })}
                allLabel={t("onb.all.grades")}
              />
            </Field>
            <Field label={t("onb.fld.sections")} hint={t("onb.fld.optional")}>
              <ChipPicker
                options={QUIZ_SECTIONS.filter((s) => s !== "All sections")}
                selected={data.sections}
                onToggle={(v) => toggleIn("sections", v)}
                onSetAll={(next) => set({ sections: next })}
                allLabel={t("onb.all.sections")}
                onAdd={(v) => set({ sections: [...data.sections, v] })}
                addPlaceholder={t("onb.fld.addSection.ph")}
                addButtonLabel={t("onb.fld.addSection.btn")}
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

            <p className="text-[12px] text-muted italic">
              {t("onb.students.skipNote")}
            </p>

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
