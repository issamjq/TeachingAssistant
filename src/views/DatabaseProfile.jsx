import React, { useState, useEffect } from "react";
import { Calendar, Hash, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MAJORS, QUIZ_LANGUAGES } from "../lib/enums";
import { ChipMultiSelect, DatePicker, Field, api, inputClasses, invalidateProfile } from "./_shared";
import BrandLoader from "../components/BrandLoader";

const initials = (first, last) =>
  `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase();

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

      {loading && <BrandLoader compact fullscreen={false} />}

      {me && (
        <Card>
          <CardContent className="p-8">
            {editing ? (
              <ProfileEditor
                initial={me}
                onClose={() => setEditing(false)}
                onSaved={onSaved}
              />
            ) : (
              <>
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
                    label="Registered"
                    value={me.hire_date ? new Date(me.hire_date).toLocaleDateString() : "—"}
                    icon={<Calendar size={13} />}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
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
// Grades + sections used to live here as a per-major class_map, but
// they now live PER SCHOOL in My Schools, so this editor only handles
// the teacher-level fields: staff ID, bio, hire date, languages, and
// the flat majors list. Per-major × per-grade × per-section editing
// lives next to the school it applies to, which removes the duplicate
// "edit this in two places" trap.
function ProfileEditor({ initial, onClose, onSaved }) {
  const [staffId, setStaffId] = useState(initial.staff_id || "");
  const [hireDate, setHireDate] = useState(initial.hire_date ? initial.hire_date.slice(0, 10) : "");
  const [bio, setBio] = useState(initial.bio || "");
  const [languages, setLanguages] = useState(Array.isArray(initial.languages) ? initial.languages : []);
  const [majors, setMajors] = useState(Array.isArray(initial.majors) ? initial.majors : []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const body = {
        staff_id: staffId,
        hire_date: hireDate || null,
        bio,
        languages,
        majors,
      };
      const updated = await api("/api/me", { method: "PATCH", body });
      invalidateProfile();
      onSaved(updated);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div>
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
          <Field label="Registered">
            <DatePicker value={hireDate || ""} onChange={(v) => setHireDate(v)} />
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
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
            Majors you teach
          </p>
          <ChipMultiSelect
            value={majors}
            onChange={setMajors}
            options={MAJORS}
            allowCustom
            customPlaceholder="Add a major not listed (e.g. Robotics)…"
          />
          <p className="text-xs text-muted mt-2">
            Grades and sections live <em className="italic">per school</em> — open <span className="text-ink">My schools</span> and tap <span className="text-ink">Edit grades</span> on a school card to set what you teach where.
          </p>
        </div>

      <div className="mt-8 pt-5 border-t border-line flex items-center justify-end gap-3">
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
