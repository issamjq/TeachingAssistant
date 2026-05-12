import React, { useState, useEffect } from "react";
import { Calendar, Hash, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MAJORS, GRADE_LEVELS, QUIZ_LANGUAGES, QUIZ_SECTIONS } from "../lib/enums";
import { Field, Modal, ChipMultiSelect, inputClasses, api } from "./_shared";

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
        {me && (
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

      {editing && (
        <ProfileEditModal initial={me} onClose={() => setEditing(false)} onSaved={onSaved} />
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

function ProfileEditModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    staff_id: initial.staff_id || "",
    hire_date: initial.hire_date ? initial.hire_date.slice(0, 10) : "",
    bio: initial.bio || "",
    majors: initial.majors || [],
    grade_levels: initial.grade_levels || [],
    languages: initial.languages || [],
    sections: initial.sections || [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const updated = await api("/api/me", { method: "PATCH", body: form });
      onSaved(updated);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Edit teaching profile"
      title="Update your teaching details"
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      {err && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Staff ID">
          <input
            className={inputClasses}
            value={form.staff_id}
            onChange={(e) => set("staff_id", e.target.value)}
            placeholder="STF-001"
          />
        </Field>
        <Field label="Hire date">
          <input
            type="date"
            className={inputClasses}
            value={form.hire_date || ""}
            onChange={(e) => set("hire_date", e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Bio">
          <textarea
            rows={3}
            className={inputClasses}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">Majors</p>
        <ChipMultiSelect
          value={form.majors}
          onChange={(v) => set("majors", v)}
          options={MAJORS}
          allowCustom
          customPlaceholder="Add a major (e.g. Robotics)…"
        />
        <p className="text-xs text-muted mt-2">
          Pick from the list, or add your own. Custom majors are private to you.
        </p>
      </div>

      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
          Grades covered
        </p>
        <ChipMultiSelect
          value={form.grade_levels}
          onChange={(v) => set("grade_levels", v)}
          options={GRADE_LEVELS}
          allowCustom
          customPlaceholder="Add a grade (e.g. Foundation Stage)…"
        />
        <p className="text-xs text-muted mt-2">
          The students tab uses this to show only kids in your grades. Custom grades are private to you —
          they only match students if a student record uses the exact same value.
        </p>
      </div>

      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
          Languages you teach
        </p>
        <ChipMultiSelect
          value={form.languages}
          onChange={(v) => set("languages", v)}
          options={QUIZ_LANGUAGES}
          allowCustom
          customPlaceholder="Add a language (e.g. Swahili)…"
        />
        <p className="text-xs text-muted mt-2">
          AI Studio uses this to populate the Language dropdown when you generate a quiz, so the list
          shows only what you actually teach. Custom languages are private to you.
        </p>
      </div>

      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
          Sections you teach
        </p>
        <ChipMultiSelect
          value={form.sections}
          onChange={(v) => set("sections", v)}
          options={QUIZ_SECTIONS}
          allowCustom
          customPlaceholder="Add a section (e.g. 8A, Maths Track)…"
        />
        <p className="text-xs text-muted mt-2">
          AI Studio uses this to populate the Section dropdown when you generate a quiz. Add the
          specific class sections you teach (Grade 6 &ldquo;A&rdquo;, Grade 6 &ldquo;B&rdquo;, etc.).
          Custom sections are private to you.
        </p>
      </div>
    </Modal>
  );
}
