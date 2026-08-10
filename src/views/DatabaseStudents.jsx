"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, Phone, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS, NATIONALITIES } from "../lib/enums";
import BrandLoader from "../components/BrandLoader";
import {
  Field,
  Modal,
  ConfirmDelete,
  RowActions,
  SortHeader,
  useSortable,
  inputClasses,
  selectClasses,
  api,
  DatePicker,
} from "./_shared";

const initials = (first, last) =>
  `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase();

const ageYears = (dob) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};

const fullName = (s) => `${s.first_name} ${s.last_name}`;

export default function DatabaseStudents() {
  const [students, setStudents] = useState([]);
  const [mySchools, setMySchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [editing, setEditing] = useState(null); // student row being edited, or "new"
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    setLoading(true);
    api("/api/students?teacher=me")
      .then((data) => {
        setStudents(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };
  useEffect(reload, []);
  useEffect(() => {
    // Fire-and-forget — drives the optional school filter and the
    // per-row school chip. Failure is silent: the page still works.
    api("/api/schools/mine").then((rows) => setMySchools(rows || [])).catch(() => {});
  }, []);
  const schoolNameById = useMemo(() => {
    const m = new Map();
    for (const s of mySchools) m.set(s.id, s.name);
    return m;
  }, [mySchools]);

  const sectionOptions = useMemo(() => {
    const set = new Set(students.map((s) => s.section).filter(Boolean));
    return [...set].sort();
  }, [students]);

  const filtered = useMemo(() => {
    let rows = students;
    if (gradeFilter) rows = rows.filter((s) => s.grade === gradeFilter);
    if (sectionFilter) rows = rows.filter((s) => s.section === sectionFilter);
    if (schoolFilter) rows = rows.filter((s) => String(s.school_id || "") === schoolFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (s) =>
          fullName(s).toLowerCase().includes(q) ||
          (s.student_id || "").toLowerCase().includes(q) ||
          (s.primary_guardian_name || "").toLowerCase().includes(q) ||
          (s.section || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [students, query, gradeFilter, sectionFilter, schoolFilter]);

  const { sorted, sort, toggle } = useSortable(filtered, {
    getValue: (s, key) => {
      if (key === "name") return fullName(s);
      if (key === "age") return ageYears(s.date_of_birth);
      if (key === "grade") return `${s.grade} ${s.section}`;
      if (key === "guardian") return s.primary_guardian_name;
      return s[key];
    },
  });

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/students/${deleting.id}`, { method: "DELETE" });
      setStudents((rows) => rows.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      alert(`Could not delete: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const onSaved = (saved, isNew) => {
    if (isNew) setStudents((rows) => [saved, ...rows]);
    else setStudents((rows) => rows.map((r) => (r.id === saved.id ? saved : r)));
    setEditing(null);
  };

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> My students
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Your <em className="italic font-light text-accent">students</em>
          </h2>
          <p className="text-muted mt-2">
            Only kids in the grades you teach. No one else&rsquo;s class is visible.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={15} className="mr-2" /> New student
        </Button>
      </div>

      {/* Search + two filter selects. The selects use selectClasses
          which carries w-full — fine on mobile (full column) but on
          md+ we need to cap them so the search input keeps its
          breathing room. md:w-48 + md:flex-none locks each select to
          ~12rem and stops flex from stretching them. */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex-1 min-w-0 bg-paper-cool rounded-lg border border-line px-4 py-2.5 flex items-center gap-2">
          <Search size={15} className="text-muted flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="outline-none w-full text-sm bg-transparent text-ink placeholder:text-muted"
            placeholder="Search by name, student ID, guardian, section…"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className={`${selectClasses} md:w-48 md:flex-none`}
        >
          <option value="">All grades</option>
          {GRADE_LEVELS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className={`${selectClasses} md:w-48 md:flex-none`}
        >
          <option value="">All sections</option>
          {sectionOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {mySchools.length > 1 && (
          <select
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            className={`${selectClasses} md:w-56 md:flex-none`}
          >
            <option value="">All schools</option>
            {mySchools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">
            Could not load students
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      {loading ? (
        <BrandLoader compact fullscreen={false} />
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-4">
          Showing <span className="text-ink">{sorted.length}</span> of {students.length} students
        </p>
      )}

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <SortHeader label="Student" sortKey="name" sort={sort} onToggle={toggle} className="px-5" />
                  <SortHeader label="ID" sortKey="student_id" sort={sort} onToggle={toggle} />
                  <SortHeader label="Grade · Section" sortKey="grade" sort={sort} onToggle={toggle} />
                  <SortHeader label="Age" sortKey="age" sort={sort} onToggle={toggle} />
                  <SortHeader label="Nationality" sortKey="nationality" sort={sort} onToggle={toggle} />
                  <SortHeader label="Primary guardian" sortKey="guardian" sort={sort} onToggle={toggle} className="px-5" />
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const age = ageYears(s.date_of_birth);
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition"
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-paper-warm border border-line flex items-center justify-center font-mono text-[11px] tracking-wider text-ink-soft flex-shrink-0">
                            {initials(s.first_name, s.last_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-serif text-base text-ink leading-tight">
                              {s.first_name} {s.last_name}
                            </p>
                            {s.notes && (
                              <p className="text-xs text-muted mt-0.5 truncate max-w-[28ch]">{s.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-[11px] text-ink-soft">{s.student_id || "—"}</td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="text-ink">{s.grade}</span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                            {s.section}
                          </span>
                          {mySchools.length > 1 && s.school_id && schoolNameById.get(s.school_id) && (
                            <span className="text-[10.5px] text-clay/80 mt-0.5 truncate max-w-[14ch]">
                              {schoolNameById.get(s.school_id)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-ink-soft">{age != null ? age : "—"}</td>
                      <td className="py-4 text-ink-soft text-xs">{s.nationality || "—"}</td>
                      <td className="py-4 px-5">
                        <div className="text-xs">
                          <p className="text-ink">{s.primary_guardian_name || "—"}</p>
                          {s.primary_guardian_relationship && (
                            <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-0.5">
                              {s.primary_guardian_relationship}
                            </p>
                          )}
                          {s.primary_guardian_phone && (
                            <p className="inline-flex items-center gap-1.5 text-muted mt-1">
                              <Phone size={11} /> {s.primary_guardian_phone}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <RowActions
                          onEdit={() => setEditing(s)}
                          onDelete={() => setDeleting(s)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted">
                      {/* An empty roster and a roster hidden by a filter are
                          different problems. Telling a teacher who has never
                          added anyone to check their filters sends them
                          looking for a control they never touched. */}
                      {students.length === 0
                        ? "No students yet. Add your first with New student."
                        : "No students match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <StudentEditModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? `Delete ${fullName(deleting)}?` : ""}
        message={
          deleting
            ? `${fullName(deleting)} (${deleting.student_id || "no ID"}) will be removed from the database.`
            : ""
        }
      />
    </div>
  );
}

const EMPTY_STUDENT = {
  first_name: "",
  last_name: "",
  student_id: "",
  date_of_birth: "",
  gender: "",
  grade: "",
  section: "",
  email: "",
  phone: "",
  nationality: "",
  address: "",
  primary_guardian_name: "",
  primary_guardian_relationship: "",
  primary_guardian_email: "",
  primary_guardian_phone: "",
  secondary_guardian_name: "",
  secondary_guardian_relationship: "",
  secondary_guardian_email: "",
  secondary_guardian_phone: "",
  enrollment_date: "",
  notes: "",
  school_id: "",
};

function StudentEditModal({ initial, onClose, onSaved }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY_STUDENT;
    return {
      ...EMPTY_STUDENT,
      ...initial,
      date_of_birth: initial.date_of_birth ? initial.date_of_birth.slice(0, 10) : "",
      enrollment_date: initial.enrollment_date ? initial.enrollment_date.slice(0, 10) : "",
      school_id: initial.school_id ?? "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  // Teacher's schools — used to populate the school select. If the
  // teacher has only one, it's auto-picked as the default for new students.
  const [mySchools, setMySchools] = useState([]);
  useEffect(() => {
    api("/api/schools/mine")
      .then((rows) => {
        const list = rows || [];
        setMySchools(list);
        if (isNew && !form.school_id) {
          const primary = list.find((s) => s.is_primary) || list[0];
          if (primary) setForm((f) => ({ ...f, school_id: primary.id }));
        }
      })
      .catch(() => { /* silent — student form still works without it */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const saved = isNew
        ? await api("/api/students", { method: "POST", body: form })
        : await api(`/api/students/${initial.id}`, { method: "PATCH", body: form });
      onSaved(saved, isNew);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={isNew ? "New student" : "Edit student"}
      title={isNew ? "Add a student" : `Edit ${initial.first_name} ${initial.last_name}`}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create student" : "Save changes"}
          </Button>
        </>
      }
    >
      {err && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Basics</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Field label="First name">
          <input className={inputClasses} value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)} required />
        </Field>
        <Field label="Last name">
          <input className={inputClasses} value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)} required />
        </Field>
        <Field label="Student ID">
          <input className={inputClasses} value={form.student_id}
            onChange={(e) => set("student_id", e.target.value)} />
        </Field>
        <Field label="Date of birth">
          <DatePicker value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
        </Field>
        <Field label="Gender">
          <select className={selectClasses} value={form.gender}
            onChange={(e) => set("gender", e.target.value)}>
            <option value="">—</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Nationality">
          <select className={selectClasses} value={form.nationality}
            onChange={(e) => set("nationality", e.target.value)}>
            <option value="">—</option>
            {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Class</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Field label="Grade">
          <select className={selectClasses} value={form.grade}
            onChange={(e) => set("grade", e.target.value)} required>
            <option value="">—</option>
            {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Section">
          <input className={inputClasses} value={form.section}
            onChange={(e) => set("section", e.target.value)} required />
        </Field>
        <Field label="Enrollment date">
          <DatePicker value={form.enrollment_date} onChange={(v) => set("enrollment_date", v)} />
        </Field>
        {mySchools.length > 0 && (
          <div className={mySchools.length === 1 ? "hidden" : "md:col-span-3"}>
            <Field
              label="School"
              hint={mySchools.length === 1 ? "auto-assigned" : "pick which of your schools"}
            >
              <select
                className={selectClasses}
                value={form.school_id ?? ""}
                onChange={(e) => set("school_id", e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">—</option>
                {mySchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.is_primary ? " · primary" : ""} ({s.emirate})
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Contact</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Field label="Email">
          <input type="email" className={inputClasses} value={form.email}
            onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Phone">
          <input className={inputClasses} value={form.phone}
            onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Address">
            <input className={inputClasses} value={form.address}
              onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
        Primary guardian
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Field label="Name">
          <input className={inputClasses} value={form.primary_guardian_name}
            onChange={(e) => set("primary_guardian_name", e.target.value)} />
        </Field>
        <Field label="Relationship">
          <input className={inputClasses} value={form.primary_guardian_relationship}
            onChange={(e) => set("primary_guardian_relationship", e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" className={inputClasses} value={form.primary_guardian_email}
            onChange={(e) => set("primary_guardian_email", e.target.value)} />
        </Field>
        <Field label="Phone">
          <input className={inputClasses} value={form.primary_guardian_phone}
            onChange={(e) => set("primary_guardian_phone", e.target.value)} />
        </Field>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
        Secondary guardian (optional)
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Field label="Name">
          <input className={inputClasses} value={form.secondary_guardian_name}
            onChange={(e) => set("secondary_guardian_name", e.target.value)} />
        </Field>
        <Field label="Relationship">
          <input className={inputClasses} value={form.secondary_guardian_relationship}
            onChange={(e) => set("secondary_guardian_relationship", e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" className={inputClasses} value={form.secondary_guardian_email}
            onChange={(e) => set("secondary_guardian_email", e.target.value)} />
        </Field>
        <Field label="Phone">
          <input className={inputClasses} value={form.secondary_guardian_phone}
            onChange={(e) => set("secondary_guardian_phone", e.target.value)} />
        </Field>
      </div>

      <Field label="Notes">
        <textarea rows={2} className={inputClasses} value={form.notes}
          onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </Modal>
  );
}
