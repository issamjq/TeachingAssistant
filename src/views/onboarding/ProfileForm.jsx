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
import { ChevronRight, ChevronLeft, Check, Download, Upload, FileText, X, Plus, MapPin, Search, Star, Trash2, Layers, Loader2 } from "lucide-react";
import { MAJORS, GRADE_LEVELS, QUIZ_LANGUAGES, QUIZ_SECTIONS } from "../../lib/enums";
import { EMIRATES } from "../../lib/schools";
import {
  setPendingProfile, getPendingProfile,
  setPendingStudents, getPendingStudents,
  setPendingSchools, getPendingSchools,
} from "../../lib/account";
import { useT, useI18n } from "../../lib/i18n";
import { SkeletonList } from "../../components/ui/skeleton";
import Avatar from "../../components/Avatar";
import { avatarsFor } from "../../lib/avatars";
import { api } from "../_shared";

// 4-step wizard. Grades + sections used to live in their own "scope"
// step, but teachers couldn't tell why they were picking grades up-
// front when each school could differ. Now each school carries its
// own grade_sections directly — the schools step IS the grades step.
const STEPS = ["identity", "subjects", "schools", "students"];

const EMPTY = {
  firstName: "",
  lastName: "",
  staffId: "",
  gender: "",
  avatar: "",
  bio: "",
  majors: [],
  languages: [],
  // grades / gradeSections / sections used to be filled by a "scope"
  // step. They're now derived at save time from the union of every
  // school's grade_sections (see handleChoosePlan in Landing.jsx),
  // but we keep the empty shape on the local form state so legacy
  // resume payloads from older builds still load cleanly.
  grades: [],
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
  // Loading flags for the roster template download + CSV import so the
  // teacher gets a spinner instead of a button that seems to do nothing.
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const step = STEPS[stepIdx];
  const last = stepIdx === STEPS.length - 1;

  // Talabat-style required-field handling: instead of a dead disabled
  // button, Next stays live — pressing it with gaps scrolls the teacher
  // to the first missing field and flags it. `attempted` flips on after
  // the first failed Next so empty fields glow only once they've tried.
  const [attempted, setAttempted] = useState(false);
  const fieldRefs = useRef({});
  const setFieldRef = (key) => (el) => { if (el) fieldRefs.current[key] = el; };
  // A fresh step starts clean — don't carry the previous step's red flags.
  useEffect(() => { setAttempted(false); }, [stepIdx]);

  // Ordered list of missing required fields for the current step. Order
  // matches the on-screen order so we scroll to the topmost gap first.
  const missingFields = () => {
    if (step === "identity") {
      const out = [];
      if (!data.firstName.trim()) out.push("firstName");
      if (!data.lastName.trim()) out.push("lastName");
      if (!data.staffId.trim()) out.push("staffId");
      if (!data.gender) out.push("gender");
      if (!data.avatar) out.push("avatar");
      return out;
    }
    if (step === "subjects") {
      const out = [];
      if (data.majors.length === 0) out.push("majors");
      if (data.languages.length === 0) out.push("languages");
      return out;
    }
    if (step === "schools") return valid ? [] : ["schools"];
    return [];
  };
  const isMissing = (key) => attempted && missingFields().includes(key);

  // Track the furthest step reached so the preview rail only lets the
  // teacher jump back to steps they've already seen (jumping forward
  // would skip validation). Clicking a visited step edits it in place.
  const [maxVisited, setMaxVisited] = useState(0);
  useEffect(() => { setMaxVisited((m) => Math.max(m, stepIdx)); }, [stepIdx]);
  const goToStep = (i) => { if (i <= maxVisited && i !== stepIdx) setStepIdx(i); };

  // Short per-step summary shown in the preview rail.
  const stepSummary = (s) => {
    if (s === "identity") {
      const name = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
      return name || data.staffId || null;
    }
    if (s === "subjects") {
      const n = (data.majors.length || 0) + (data.languages.length || 0);
      return n > 0 ? t("onb.rail.subjectsSummary", { m: data.majors.length, l: data.languages.length }) : null;
    }
    if (s === "schools") {
      return schools.length > 0 ? t("onb.rail.schoolsSummary", { n: schools.length }) : null;
    }
    if (s === "students") {
      return students.length > 0 ? t("onb.rail.studentsSummary", { n: students.length }) : null;
    }
    return null;
  };

  // Lightweight per-step validation. Schools step needs every school
  // to have at least one grade picked AND every picked grade to have
  // at least one section — same per-grade rule as the old scope step,
  // just applied per-school now.
  const valid =
    step === "identity"
      ? data.firstName.trim().length > 0 &&
        data.lastName.trim().length > 0 &&
        data.staffId.trim().length > 0 &&
        data.gender.length > 0 &&
        data.avatar.length > 0
      : step === "subjects"
        ? data.majors.length > 0 && data.languages.length > 0
        : step === "schools"
          ? schools.length > 0 &&
            schools.every((s) => {
              const gs = s.gradeSections || {};
              const grades = Object.keys(gs);
              return grades.length > 0 && grades.every((g) => (gs[g] || []).length > 0);
            })
          : true; // students step — always valid (skippable)

  const handleTemplateDownload = () => {
    if (downloadingTemplate) return;
    setDownloadingTemplate(true);
    // The blob write itself is instant; the short hold just lets the
    // spinner register so the click feels acknowledged.
    const csv = rowsToCsv(STUDENT_COLUMNS, TEMPLATE_ROWS);
    downloadCsv("murchid-students-template.csv", csv);
    setTimeout(() => setDownloadingTemplate(false), 600);
  };
  const handleFile = (file) => {
    if (!file) return;
    setImportError(null);
    setImporting(true);
    const finish = () => setImporting(false);
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
      } finally {
        finish();
      }
    };
    reader.onerror = () => { setImportError(t("onb.students.errParse")); finish(); };
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


  const next = () => {
    if (!valid) {
      // Talabat-style: surface the gaps and glide to the first one.
      setAttempted(true);
      const first = missingFields()[0];
      const el = first && fieldRefs.current[first];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Focus the first interactive control inside so keyboard users
        // land where they need to type (without a second scroll jump).
        el.querySelector("input, textarea, select, button")?.focus?.({ preventScroll: true });
      }
      return;
    }
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
      className="min-h-[100dvh] flex items-start justify-center px-4 py-8 sm:py-12"
      style={{ background: "var(--paper)" }}
      dir={dir}
    >
      <div className="w-full max-w-[980px] lg:flex lg:items-start lg:gap-10">
      {/* Preview / edit rail — desktop only. Lets the teacher see every
          step at a glance and click back into any they've already
          visited. On phones the ProgressDots above the form cover this. */}
      <StepsRail
        steps={STEPS}
        active={stepIdx}
        maxVisited={maxVisited}
        onJump={goToStep}
        summary={stepSummary}
        t={t}
      />
      <div className="w-full max-w-[640px] mx-auto lg:mx-0 lg:flex-1 min-w-0">
        <div className="lg:hidden">
          <ProgressDots count={STEPS.length} active={stepIdx} />
        </div>
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
            <Field label={t("onb.fld.firstName")} required ref={setFieldRef("firstName")} invalid={isMissing("firstName")} errorText={t("onb.fld.required")}>
              <input
                type="text"
                value={data.firstName}
                onChange={(e) => set({ firstName: e.target.value })}
                autoFocus
                className={`onb-input ${isMissing("firstName") ? "onb-input-invalid" : ""}`}
                placeholder={t("onb.ph.firstName")}
              />
            </Field>
            <Field label={t("onb.fld.lastName")} required ref={setFieldRef("lastName")} invalid={isMissing("lastName")} errorText={t("onb.fld.required")}>
              <input
                type="text"
                value={data.lastName}
                onChange={(e) => set({ lastName: e.target.value })}
                className={`onb-input ${isMissing("lastName") ? "onb-input-invalid" : ""}`}
                placeholder={t("onb.ph.lastName")}
              />
            </Field>
            <Field label={t("onb.fld.staffId")} required ref={setFieldRef("staffId")} invalid={isMissing("staffId")} errorText={t("onb.fld.required")}>
              <input
                type="text"
                value={data.staffId}
                onChange={(e) => set({ staffId: e.target.value })}
                className={`onb-input ${isMissing("staffId") ? "onb-input-invalid" : ""}`}
                placeholder={t("onb.ph.staffId")}
              />
            </Field>
          </div>
          <Field label={t("onb.fld.gender")} required ref={setFieldRef("gender")} invalid={isMissing("gender")} errorText={t("onb.fld.required")}>
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
          <Field label={t("onb.fld.avatar")} required ref={setFieldRef("avatar")} invalid={isMissing("avatar")} errorText={t("onb.fld.required")}>
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
            <Field label={t("onb.fld.majors")} required ref={setFieldRef("majors")} invalid={isMissing("majors")} errorText={t("onb.fld.required")}>
              <ChipPicker
                options={MAJORS}
                selected={data.majors}
                onToggle={(v) => toggleIn("majors", v)}
                onSetAll={(next) => set({ majors: next })}
                allLabel={t("onb.all.majors")}
              />
            </Field>
            <Field label={t("onb.fld.languages")} required ref={setFieldRef("languages")} invalid={isMissing("languages")} errorText={t("onb.fld.required")}>
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

        {step === "schools" && (
          <div ref={setFieldRef("schools")} className="scroll-mt-24">
            <SchoolsStep
              t={t}
              value={schools}
              onChange={setSchools}
            />
            <div className="mt-6">
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
                    disabled={downloadingTemplate}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-line bg-paper-cool hover:border-ink/40 transition-colors text-[13px] font-medium text-ink disabled:opacity-60 disabled:cursor-wait"
                  >
                    {downloadingTemplate ? (
                      <Loader2 size={14} className="text-accent animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Download size={14} className="text-accent" />
                    )}
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
                    disabled={importing}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-line bg-paper-cool hover:border-ink/40 transition-colors text-[13px] font-medium text-ink disabled:opacity-60 disabled:cursor-wait"
                  >
                    {importing ? (
                      <Loader2 size={14} className="text-ink animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Upload size={14} className="text-ink" />
                    )}
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
              aria-disabled={!valid}
              className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium btn-primary transition-opacity ${!valid ? "opacity-60" : ""}`}
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
        .onb-input-invalid {
          border-color: var(--clay, #c8472b);
          box-shadow: 0 0 0 3px rgba(200, 71, 43, 0.12);
          animation: onb-shake 0.32s cubic-bezier(0.36, 0.07, 0.19, 0.97);
        }
        @keyframes onb-shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-3px); }
          40%, 60% { transform: translateX(3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .onb-input-invalid { animation: none; }
        }
        /* Grade rows + section chips ease in as the teacher builds out a
           school's scope, so the form feels alive while they pick. */
        .onb-pop-in {
          animation: onb-pop-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes onb-pop-in {
          from { opacity: 0; transform: translateY(8px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .onb-chip-in {
          animation: onb-chip-in 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes onb-chip-in {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .onb-pop-in, .onb-chip-in { animation: none; }
        }
      `}</style>
    </div>
  );
}

// Preview / edit rail shown beside the wizard on desktop. Each row is a
// step: a status dot (done / current / upcoming), its label, and a live
// summary of what's been entered. Visited steps are clickable to jump
// back and edit; upcoming steps are inert.
function StepsRail({ steps, active, maxVisited, onJump, summary, t }) {
  return (
    <aside className="hidden lg:block w-[240px] flex-shrink-0 sticky top-12">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-4">
        {t("onb.rail.title")}
      </p>
      <ol className="space-y-1">
        {steps.map((s, i) => {
          const isCurrent = i === active;
          const isDone = i < active || (i <= maxVisited && i !== active);
          const visited = i <= maxVisited;
          const sum = summary(s);
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => onJump(i)}
                disabled={!visited || isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                className={`group w-full text-start flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  isCurrent
                    ? "bg-clay/[0.07] ring-1 ring-clay/30"
                    : visited
                      ? "hover:bg-paper-warm cursor-pointer"
                      : "opacity-55 cursor-default"
                }`}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono font-semibold transition-colors ${
                    isCurrent
                      ? "bg-clay text-paper-cool"
                      : isDone
                        ? "bg-sage/20 text-sage"
                        : "bg-paper-warm text-muted border border-line"
                  }`}
                >
                  {isDone && !isCurrent ? <Check size={11} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`text-[13px] font-medium leading-tight ${isCurrent ? "text-ink" : "text-ink-soft"}`}>
                      {t(`onb.rail.step.${s}`)}
                    </span>
                    {visited && !isCurrent && (
                      <span className="text-[10px] text-clay opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5">
                        {t("onb.rail.edit")}
                      </span>
                    )}
                  </span>
                  <span className={`block text-[11.5px] leading-snug mt-0.5 truncate ${
                    isCurrent ? "text-clay" : "text-muted"
                  }`}>
                    {isCurrent ? t("onb.rail.current") : (sum || "—")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
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
const Field = React.forwardRef(function Field({ label, hint, required, invalid, errorText, children }, ref) {
  return (
    // scroll-mt-24 keeps the field clear of the sticky-ish header when
    // scrollIntoView jumps here after a failed Next (Talabat-style).
    <div ref={ref} className="scroll-mt-24">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span
          className="text-[13px] font-medium transition-colors"
          style={{ color: invalid ? "var(--clay)" : "var(--ink)" }}
        >
          {label}
          {required && <span style={{ color: "var(--clay)" }}> *</span>}
        </span>
        {invalid && errorText ? (
          <span className="text-[11px] font-medium" style={{ color: "var(--clay)" }}>
            {errorText}
          </span>
        ) : hint ? (
          <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
});

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
function SchoolsStep({ t, value, onChange }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");
  const [emirateFilter, setEmirateFilter] = useState("");
  const [customName, setCustomName] = useState("");
  const [customEmirate, setCustomEmirate] = useState("Dubai");

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

  // Per-school grades + sections. Each school carries its own
  // gradeSections map ({ "Grade 1": ["A", "B"], ... }) — there's no
  // global default anymore. Adding a grade starts it with an empty
  // section array so the teacher is forced to pick at least one
  // section to advance (mirrors the old scope-step validation).
  const toggleSchoolGrade = (school_id, grade) => {
    onChange(value.map((s) => {
      if (s.school_id !== school_id) return s;
      const gs = { ...(s.gradeSections || {}) };
      if (grade in gs) delete gs[grade];
      else gs[grade] = [];
      return { ...s, gradeSections: gs };
    }));
  };
  const setSchoolAllGrades = (school_id, nextList) => {
    onChange(value.map((s) => {
      if (s.school_id !== school_id) return s;
      const prev = s.gradeSections || {};
      const gs = {};
      for (const g of nextList) gs[g] = prev[g] || [];
      return { ...s, gradeSections: gs };
    }));
  };
  const setSchoolSectionsForGrade = (school_id, grade, sections) => {
    onChange(value.map((s) => {
      if (s.school_id !== school_id) return s;
      const gs = { ...(s.gradeSections || {}), [grade]: sections };
      return { ...s, gradeSections: gs };
    }));
  };
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

  return (
    <div className="space-y-5">
      {/* Selected schools — each card carries its own grades + sections
          right inside it, so the teacher sees one school, picks the
          grades they teach THERE, picks each grade's sections, and
          moves on. No global default, no separate scope step, no
          inheritance to second-guess. */}
      {value.length > 0 && (
        <div className="rounded-xl border border-sage/40 bg-sage/[0.06] p-3 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-2">
            <MapPin size={11} className="text-sage" />
            {t("onb.schools.selected")} · {value.length}
          </p>
          <ul className="space-y-3">
            {value.map((s) => {
              const gs = s.gradeSections || {};
              const schoolGrades = Object.keys(gs);
              const remaining = GRADE_LEVELS.filter((g) => !(g in gs));
              const allOn = schoolGrades.length === GRADE_LEVELS.length;
              return (
                <li
                  key={s.school_id}
                  className="rounded-xl bg-paper-cool border border-line/70 overflow-hidden"
                >
                  {/* Top row — school name + chrome */}
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium text-ink truncate">
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

                  {/* Per-school grade + section picker. Empty card
                      surfaces a single clay-tinted prompt; once grades
                      are picked each gets its own GradeSectionRow with
                      remove-grade affordance. */}
                  <div className="px-3.5 pb-3.5 pt-1 border-t border-line/60 bg-paper/40 space-y-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-1.5 pt-1">
                      <Layers size={11} strokeWidth={2.25} className="text-clay" />
                      {t("onb.school.scope.eyebrow")}
                    </p>

                    {schoolGrades.length > 0 && (
                      <div className="space-y-2.5">
                        {schoolGrades.map((g) => (
                          <GradeSectionRow
                            key={g}
                            grade={g}
                            sections={gs[g] || []}
                            onChange={(next) => setSchoolSectionsForGrade(s.school_id, g, next)}
                            onRemove={() => toggleSchoolGrade(s.school_id, g)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Tap-to-add row. Always visible until every grade
                        is picked — keeps the multi-pick affordance in
                        the teacher's face without an expand step. */}
                    {remaining.length > 0 && (
                      <div className="rounded-xl border border-dashed border-line bg-paper-cool/40 p-2.5">
                        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-1.5">
                          <Plus size={10} strokeWidth={2.5} />
                          {schoolGrades.length === 0
                            ? t("onb.school.scope.addFirst")
                            : t("onb.school.scope.addMore")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSchoolAllGrades(s.school_id, allOn ? [] : [...GRADE_LEVELS])}
                            aria-pressed={allOn}
                            className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold border transition-colors ${
                              allOn
                                ? "bg-accent text-paper-cool border-accent"
                                : "bg-paper-cool text-accent border-accent hover:bg-accent/10"
                            }`}
                          >
                            {t("onb.all.grades")}
                          </button>
                          {remaining.map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => toggleSchoolGrade(s.school_id, g)}
                              className="px-2.5 py-1 rounded-full text-[11.5px] font-medium border bg-paper text-ink border-line hover:border-ink transition-colors"
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
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
        <SkeletonList count={5} className="rounded-xl" />
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
function GradeSectionRow({ grade, sections, onChange, onRemove }) {
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
    <div className={`onb-pop-in rounded-xl border p-3.5 transition-colors ${
      empty
        ? "border-clay/40 bg-clay/[0.04]"
        : "border-line bg-paper-cool/60"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="inline-flex items-center gap-2 min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink">
            {grade}
          </p>
          <span className={`text-[11px] ${empty ? "text-clay" : "text-muted"}`}>
            ·{" "}
            {empty
              ? "Pick at least one section"
              : `${sections.length} section${sections.length > 1 ? "s" : ""}`}
          </span>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove this grade"
            aria-label={`Remove ${grade}`}
            className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-soft hover:bg-accent hover:text-paper-cool transition-colors"
          >
            <X size={12} />
          </button>
        )}
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
