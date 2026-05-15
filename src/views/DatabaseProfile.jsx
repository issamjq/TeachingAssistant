import React, { useState, useEffect, useMemo } from "react";
import { Calendar, Hash, Pencil, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MAJORS, GRADE_LEVELS, QUIZ_LANGUAGES, QUIZ_SECTIONS } from "../lib/enums";
import { Field, ChipMultiSelect, inputClasses, api } from "./_shared";

const initials = (first, last) =>
  `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase();

// Build a clean class_map from whatever the teacher row holds. If
// class_map is empty but the legacy flat arrays carry data, seed a
// single all-purpose entry so the editor isn't blank.
function buildInitialClassMap(me) {
  if (Array.isArray(me?.class_map) && me.class_map.length > 0) {
    return me.class_map.map((row) => ({
      major: row.major || "",
      grades: Array.isArray(row.grades) ? row.grades : [],
      sections: Array.isArray(row.sections) ? row.sections : [],
    }));
  }
  const majors = Array.isArray(me?.majors) ? me.majors : [];
  if (majors.length === 0) return [];
  const grades = Array.isArray(me?.grade_levels) ? me.grade_levels : [];
  const sections = Array.isArray(me?.sections) ? me.sections : [];
  return majors.map((major) => ({ major, grades: [...grades], sections: [...sections] }));
}

// Compress the class_map down to the three flat arrays the rest of
// the app already consumes (Studio dropdowns, manual forms, etc).
function flattenClassMap(classMap) {
  const majors = new Set();
  const grades = new Set();
  const sections = new Set();
  for (const row of classMap || []) {
    if (row.major) majors.add(row.major);
    for (const g of row.grades || []) if (g) grades.add(g);
    for (const s of row.sections || []) if (s) sections.add(s);
  }
  return {
    majors: [...majors],
    grade_levels: [...grades],
    sections: [...sections],
  };
}

export default function DatabaseProfile() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api("/api/me")
      .then((data) => {
        setMe(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const onSaved = (updated) => {
    setMe(updated);
    setEditing(false);
  };

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Teaching profile
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Your <em className="italic font-light text-accent">teaching profile</em>
          </h2>
          <p className="text-muted mt-2">
            Subjects, grades, and bio. Personal contact details live under your account.
          </p>
        </div>
        {me && !editing && (
          <Button onClick={() => setEditing(true)}>
            <Pencil size={14} className="mr-2" /> Edit
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">
            Could not load your profile
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      {loading && (
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
          Loading profile from Neon…
        </p>
      )}

      {me && (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-start gap-5 mb-6">
              <div className="h-16 w-16 rounded-full bg-paper-warm border border-line flex items-center justify-center font-mono text-base tracking-wider text-ink-soft flex-shrink-0">
                {initials(me.first_name, me.last_name)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-3xl text-ink leading-tight">
                  {me.first_name} {me.last_name}
                </h3>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted mt-1.5">
                  {(me.majors || []).join(" · ") || "No majors set"}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted mt-1">
                  {(me.grade_levels || []).join(" · ") || "No grades set"}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted mt-1">
                  {(me.languages || []).join(" · ") || "No languages set"}
                </p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted mt-1">
                  {(me.sections || []).join(" · ") || "No sections set"}
                </p>
                {me.bio && (
                  <p className="text-sm text-ink-soft mt-3 max-w-2xl leading-relaxed">{me.bio}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 pt-6 border-t border-line">
              <Stat label="Staff ID" value={me.staff_id || "—"} icon={<Hash size={13} />} mono />
              <Stat
                label="Hire date"
                value={me.hire_date ? new Date(me.hire_date).toLocaleDateString() : "—"}
                icon={<Calendar size={13} />}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {me && editing && (
        <ProfileEditor initial={me} onClose={() => setEditing(false)} onSaved={onSaved} />
      )}
    </div>
  );
}

function Stat({ label, value, icon, mono = false }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-1 inline-flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className={`text-sm text-ink ${mono ? "font-mono text-[12px] text-ink-soft" : ""}`}>
        {value}
      </p>
    </div>
  );
}

// Inline editor — renders below the read panel instead of in a modal.
// Hierarchy: each Major card carries its own Grades and Sections, so
// "Math for Grades 6 + 8, sections A and B" becomes one row instead
// of three disconnected lists.
function ProfileEditor({ initial, onClose, onSaved }) {
  const [staffId, setStaffId] = useState(initial.staff_id || "");
  const [hireDate, setHireDate] = useState(initial.hire_date ? initial.hire_date.slice(0, 10) : "");
  const [bio, setBio] = useState(initial.bio || "");
  const [languages, setLanguages] = useState(Array.isArray(initial.languages) ? initial.languages : []);
  const [classMap, setClassMap] = useState(() => buildInitialClassMap(initial));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const flat = useMemo(() => flattenClassMap(classMap), [classMap]);

  const addMajor = () => setClassMap((m) => [...m, { major: "", grades: [], sections: [] }]);
  const removeMajor = (idx) => setClassMap((m) => m.filter((_, i) => i !== idx));
  const updateMajor = (idx, patch) =>
    setClassMap((m) => m.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  // Track all custom (non-enum) values so the chip lists keep them
  // available even after they've been picked.
  const allKnownMajors = useMemo(() => {
    const set = new Set(MAJORS);
    classMap.forEach((r) => r.major && set.add(r.major));
    return [...set];
  }, [classMap]);
  const allKnownGrades = useMemo(() => {
    const set = new Set(GRADE_LEVELS);
    classMap.forEach((r) => (r.grades || []).forEach((g) => set.add(g)));
    return [...set];
  }, [classMap]);
  const allKnownSections = useMemo(() => {
    const set = new Set(QUIZ_SECTIONS);
    classMap.forEach((r) => (r.sections || []).forEach((s) => set.add(s)));
    return [...set];
  }, [classMap]);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const body = {
        staff_id: staffId,
        hire_date: hireDate || null,
        bio,
        languages,
        class_map: classMap.filter((r) => r.major),
        // Denormalised flat fields so legacy consumers (Studio dropdowns,
        // useTeacherClasses, /api/me readers) keep working without a
        // migration of every call site.
        ...flat,
      };
      const updated = await api("/api/me", { method: "PATCH", body });
      onSaved(updated);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-[#e6dccb] bg-paper-cool shadow-[0_18px_44px_-22px_rgba(15,20,16,0.14)] overflow-hidden">
      <div className="px-7 pt-6 pb-4 border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 inline-flex items-center gap-2.5">
              <span className="w-6 h-px bg-accent" /> Edit teaching profile
            </p>
            <h3 className="font-serif text-2xl font-medium text-ink leading-tight">
              Update your <em className="italic font-light text-accent">teaching details</em>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="h-9 w-9 rounded-lg border border-line bg-paper-cool hover:bg-paper-warm hover:border-ink flex items-center justify-center transition"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="px-7 py-6">
        {err && (
          <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
            <p className="text-sm text-accent">{err}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Staff ID">
            <input
              className={inputClasses}
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="STF-001"
            />
          </Field>
          <Field label="Hire date">
            <input
              type="date"
              className={inputClasses}
              value={hireDate || ""}
              onChange={(e) => setHireDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Bio">
            <textarea
              rows={3}
              className={inputClasses}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
            Languages you teach
          </p>
          <ChipMultiSelect
            value={languages}
            onChange={setLanguages}
            options={QUIZ_LANGUAGES}
            allowCustom
            customPlaceholder="Add a language (e.g. Swahili)…"
          />
          <p className="text-xs text-muted mt-2">
            Studio's Language dropdown shows only what you teach. Custom languages are private to you.
          </p>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              Your classes
            </p>
            <button
              type="button"
              onClick={addMajor}
              className="planner-nav-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/[0.10] hover:bg-accent/[0.18] hover:border-accent/50 text-accent text-[11.5px] font-semibold"
            >
              <Plus size={13} strokeWidth={2.25} /> Add a major
            </button>
          </div>
          <p className="text-xs text-muted mb-3">
            For each major you teach, pick the grades and sections it covers. Math for Grades 6 + 8,
            sections A + B is one row.
          </p>

          {classMap.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center text-muted text-sm">
              No majors yet — click "Add a major" to start.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {classMap.map((row, i) => (
                <MajorCard
                  key={i}
                  row={row}
                  majorOptions={allKnownMajors}
                  gradeOptions={allKnownGrades}
                  sectionOptions={allKnownSections}
                  onChange={(patch) => updateMajor(i, patch)}
                  onRemove={() => removeMajor(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-7 py-4 border-t border-line flex items-center justify-end gap-3 bg-paper">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

// One major + the grades + sections it covers. Uses the same warm-gray
// border + soft shadow as the planner cards so it reads as part of
// the same family.
function MajorCard({ row, majorOptions, gradeOptions, sectionOptions, onChange, onRemove }) {
  return (
    <div className="rounded-2xl border border-[#e6dccb] bg-[#fdf8ee] shadow-[0_8px_20px_-14px_rgba(15,20,16,0.18)] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted mb-1.5">
            Major
          </p>
          <ChipMultiSelect
            value={row.major ? [row.major] : []}
            onChange={(v) => onChange({ major: v[v.length - 1] || "" })}
            options={majorOptions}
            allowCustom
            customPlaceholder="Add a major (e.g. Robotics)…"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove major"
          className="planner-nav-btn shrink-0 h-8 w-8 rounded-md border border-line bg-paper-cool hover:bg-accent hover:border-accent hover:text-paper-cool text-ink-soft flex items-center justify-center"
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      </div>

      <div className="mt-4">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted mb-1.5">
          Grades for this major
        </p>
        <ChipMultiSelect
          value={row.grades || []}
          onChange={(v) => onChange({ grades: v })}
          options={gradeOptions}
          allowCustom
          customPlaceholder="Add a grade (e.g. KG 1)…"
        />
      </div>

      <div className="mt-4">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted mb-1.5">
          Sections for this major
        </p>
        <ChipMultiSelect
          value={row.sections || []}
          onChange={(v) => onChange({ sections: v })}
          options={sectionOptions}
          allowCustom
          customPlaceholder="Add a section (e.g. 8A)…"
        />
      </div>
    </div>
  );
}
