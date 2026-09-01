"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, Phone, Plus, Upload, Mail, CheckCircle2, AlertTriangle, FileDown, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GRADE_LEVELS, MAJORS, NATIONALITIES } from "../lib/enums";
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
import { takePrefill } from "@/shared/lib/assistantPrefill";
import { parseRosterFile, downloadSample, SAMPLE_HEADERS } from "@/features/students/importStudents";

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

// Turn whatever the data layer threw into a sentence a teacher can act on.
// Raw Postgres/PostgREST messages ("new row violates row-level security…")
// mean nothing to them; these do. A 400 is one of our own validation
// messages, which are already written for a person, so it is shown as-is.
function friendlyError(e, fallback) {
  const status = e?.status;
  const code = e?.code;
  if (status === 402 || code === "subscription_expired")
    return "Your Murchid plan has lapsed, so changes can’t be saved right now. Renew to continue.";
  if (status === 403 || code === "42501")
    return "You don’t have permission to do that.";
  if (status === 401 || code === "session_superseded")
    return "You’ve been signed out — please sign in again.";
  if (code === "no_backend")
    return "That part of Murchid isn’t connected yet.";
  if (status === 400 && e?.message) return e.message;
  return fallback;
}

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
  /**
   * Why an invitation could not land, said in the product's own voice.
   *
   * This was a window.alert(): a grey OS box with a URL in the title, no
   * typography, and an OK button that taught the teacher nothing. The
   * message it carried is the most consequential one on this screen —
   * the child she just added can never sign in with that address — so it
   * is worth the same care as the rest of the page.
   */
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  // The assistant's "add a student called…" hand-off: collect the parked
  // payload once, open the new-student form with what it knew. The
  // teacher still confirms — the assistant never saves.
  const [prefill, setPrefill] = useState(null);
  useEffect(() => {
    const pre = takePrefill("add_student");
    if (!pre) return;
    const fields = {};
    for (const k of ["first_name", "last_name", "student_id", "grade", "section", "email", "gender", "nationality", "notes"]) {
      if (typeof pre[k] === "string" && pre[k]) fields[k] = pre[k];
    }
    // The tool may send one "name" instead of first/last.
    if (!fields.first_name && typeof pre.name === "string" && pre.name.trim()) {
      const [first, ...rest] = pre.name.trim().split(/\s+/);
      fields.first_name = first;
      if (rest.length) fields.last_name = rest.join(" ");
    }
    if (Object.keys(fields).length) {
      setPrefill(fields);
      setEditing("new");
    }
  }, []);

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
    // A new student with an email is invited in the same action, so this
    // is where a failed send surfaces for them too.
    if (saved?.invite_mail_error) {
      setNotice({ student: saved, message: saved.invite_mail_error });
    }
  };

  // Invite: open the gate AND email them the link that opens it. The two
  // can part company — Supabase's mailer is rate-limited — so the row is
  // redrawn as invited either way and only the send is reported.
  const invite = async (s) => {
    try {
      const updated = await api(`/api/students/${s.id}/invite`, { method: "POST" });
      setStudents((rows) => rows.map((r) => (r.id === s.id ? updated : r)));
      if (updated?.invite_mail_error) {
        setNotice({ student: updated, message: updated.invite_mail_error });
      }
    } catch (e) {
      alert(friendlyError(e, "Couldn’t invite this student right now. Please try again."));
    }
  };

  // Import lands as a batch of created rows — prepend them all.
  const onImported = (created) => {
    if (created?.length) setStudents((rows) => [...created, ...rows]);
    setImporting(false);
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
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setImporting(true)}>
            <Upload size={15} className="mr-2" /> Import
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus size={15} className="mr-2" /> New student
          </Button>
        </div>
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
                        <div className="flex items-center gap-3 justify-end">
                          <InviteControl s={s} onInvite={() => invite(s)} />
                          <RowActions
                            onEdit={() => setEditing(s)}
                            onDelete={() => setDeleting(s)}
                          />
                        </div>
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
          prefill={editing === "new" ? prefill : null}
          onClose={() => { setEditing(null); setPrefill(null); }}
          onSaved={onSaved}
        />
      )}

      {importing && (
        <ImportStudentsModal onClose={() => setImporting(false)} onImported={onImported} />
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

      <InviteNotice notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

/**
 * The invitation could not land, and why.
 *
 * Two outcomes arrive here and they are not the same thing, so they do not
 * read the same. An address that already teaches on Murchid is a dead end
 * the teacher must resolve with the child — no amount of resending will
 * fix it. A send that failed is a retry.
 */
function InviteNotice({ notice, onClose }) {
  const blocked = notice?.student?.invite_status === "blocked_teacher";
  const email = notice?.student?.email || "";
  const name = notice?.student
    ? [notice.student.first_name, notice.student.last_name].filter(Boolean).join(" ")
    : "";

  return (
    <Modal
      open={!!notice}
      onClose={onClose}
      eyebrow={blocked ? "Invitation blocked" : "Invitation not sent"}
      title={blocked ? "That email already teaches here" : "The invite didn’t send"}
      footer={<Button onClick={onClose}>Got it</Button>}
    >
      {blocked ? (
        <>
          <div className="flex items-start gap-3 bg-paper-warm border border-line rounded-lg p-4 mb-5">
            <AlertTriangle size={16} className="text-clay flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm text-ink">
                <span className="font-medium">{email}</span> is already a teacher account on Murchid.
              </p>
              <p className="text-sm text-muted mt-1.5">
                An account can be a teacher or a student, never both — a teacher’s account carries
                their own plan and credits, and joining a class as a student would put that at risk.
              </p>
            </div>
          </div>

          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2.5">
            What to do
          </p>
          <ol className="space-y-2.5 mb-5">
            {[
              `Ask ${name || "them"} for a different email — a personal or school address they don’t teach with.`,
              "Edit this student and replace the address.",
              "Press Invite again. The block clears the moment the email changes.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-ink-soft">
                <span className="font-mono text-[10px] text-accent mt-1 flex-shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <p className="text-xs text-muted border-t border-line pt-4">
            {name || "They"} stays on your roster meanwhile, and we’ve emailed {email} to explain.
            Their teacher account is untouched.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-ink mb-3">{notice?.message}</p>
          <p className="text-sm text-muted">
            {name || "This student"} is on your roster and the gate is open — they can sign in as
            soon as the email reaches them. Press <span className="text-ink">Invite</span> on their
            row to try again.
          </p>
        </>
      )}
    </Modal>
  );
}

// Invite gate per row: a student can log in only once invited, and only
// then with a matching email. Shows where they are: not invited (a button),
// invited (waiting to be claimed), active (they've signed in), or blocked
// because the address already teaches here.
function InviteControl({ s, onInvite }) {
  /**
   * The one state the teacher has to act on.
   *
   * She cannot fix it from here and she cannot be expected to guess it:
   * the child gave her an address that already runs a teacher account, so
   * the invitation will never be claimable no matter how often she resends
   * it. The row says what to do instead — ask for a different address —
   * because "Invited" forever is the failure this replaces.
   */
  if (s.invite_status === "blocked_teacher") {
    return (
      <span
        title={`${s.email} already has a teacher account on Murchid, so it cannot also be a student. Edit this student's email to a different address and invite them again.`}
        className="font-mono text-[9px] uppercase tracking-wider text-clay inline-flex items-center gap-1 cursor-help"
      >
        <AlertTriangle size={11} /> Already a teacher
      </span>
    );
  }
  if (s.invite_status === "active") {
    return (
      <span title="Signed in" className="font-mono text-[9px] uppercase tracking-wider text-sage inline-flex items-center gap-1">
        <CheckCircle2 size={11} /> Active
      </span>
    );
  }
  if (s.invite_status === "invited") {
    return (
      <span title="Invited — can claim their account by signing in with their email" className="font-mono text-[9px] uppercase tracking-wider text-gold inline-flex items-center gap-1">
        <Mail size={11} /> Invited
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onInvite}
      disabled={!s.email}
      title={s.email ? "Invite this student to log in" : "Add an email before inviting"}
      className="font-mono text-[9px] uppercase tracking-wider text-ink-soft hover:text-accent inline-flex items-center gap-1 transition disabled:opacity-40 disabled:hover:text-ink-soft"
    >
      <Mail size={11} /> Invite
    </button>
  );
}

// Bulk import from a CSV / Excel / PDF roster. Parses in the browser,
// previews what it found, and creates the lot on confirm.
function ImportStudentsModal({ onClose, onImported }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const onFile = async (file) => {
    if (!file) return;
    setErr(null); setNote(null); setRows(null); setParsing(true); setFileName(file.name);
    try {
      const { rows: parsed, note: n } = await parseRosterFile(file);
      setRows(parsed);
      if (n) setNote(n);
      if (!parsed.length) setErr("No students found in that file. Make sure the first row is a header (like the sample) and each student is on its own line.");
    } catch {
      setErr("We couldn’t read that file. Please use a CSV or Excel file laid out like the sample — you can download it above.");
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!rows?.length) return;
    /**
     * Caught here rather than at the insert.
     *
     * Email is NOT NULL, so a file with a blank cell fails in the database
     * with a constraint name and no line number — for a teacher looking at
     * a spreadsheet of thirty, that is unactionable. Naming the students
     * lets her fix the file.
     */
    const nameless = rows.filter((r) => !String(r.email ?? "").trim());
    if (nameless.length) {
      const who = nameless
        .slice(0, 3)
        .map((r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "a row with no name")
        .join(", ");
      setErr(
        `Every student needs an email — it is what they sign in with. ` +
        `${nameless.length} ${nameless.length === 1 ? "student has" : "students have"} none: ${who}` +
        `${nameless.length > 3 ? `, and ${nameless.length - 3} more` : ""}. ` +
        `Add the addresses to your file and import it again.`
      );
      return;
    }
    setSaving(true); setErr(null);
    try {
      const res = await api("/api/students/bulk", { method: "POST", body: { students: rows } });
      onImported(res.students || []);
    } catch (e) {
      setErr(friendlyError(e, "Some students couldn’t be saved. Check the file matches the sample format, then try again."));
      setSaving(false);
    }
  };

  const preview = (rows || []).slice(0, 20);

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Import"
      title="Import students from a file"
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={doImport} disabled={saving || !rows?.length}>
            {saving ? "Importing…" : rows?.length ? `Import ${rows.length} student${rows.length === 1 ? "" : "s"}` : "Import"}
          </Button>
        </>
      }
    >
      {err && <div className="mb-4 bg-paper border border-accent rounded-lg p-3"><p className="text-sm text-accent">{err}</p></div>}

      {/* Format guide + sample */}
      <div className="bg-paper-warm border border-line rounded-lg p-4 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2 inline-flex items-center gap-1.5">
              <FileSpreadsheet size={12} /> Expected columns
            </p>
            <p className="text-sm text-ink-soft">
              A header row, then one student per line. Recognised columns (any order, extras ignored):
            </p>
            <p className="font-mono text-[11px] text-ink mt-2 break-words">{SAMPLE_HEADERS.join(" · ")}</p>
            <p className="text-xs text-muted mt-2">
              <span className="text-ink">First name</span>, <span className="text-ink">last name</span> and
              <span className="text-ink"> email</span> are required — the address is what a student signs in with,
              so a row without one can never join. Imported students are <span className="text-ink">not</span> emailed
              automatically; invite them from the list when the roster looks right. CSV or Excel are exact;
              PDF is best-effort.
            </p>
          </div>
          <button
            onClick={downloadSample}
            className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink hover:text-accent inline-flex items-center gap-1.5 border border-line hover:border-accent rounded-lg px-3 py-2 transition"
          >
            <FileDown size={13} /> Sample CSV
          </button>
        </div>
      </div>

      {/* File picker */}
      <label className="block border-2 border-dashed border-line rounded-xl p-6 text-center cursor-pointer hover:border-ink transition mb-4">
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Upload size={20} className="mx-auto text-muted mb-2" />
        <p className="text-sm text-ink">{fileName || "Choose a CSV, Excel or PDF file"}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted mt-1">
          {parsing ? "Reading…" : "click to browse"}
        </p>
      </label>

      {note && <p className="text-xs text-gold mb-3">{note}</p>}

      {/* Preview */}
      {rows && rows.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
            Preview — {rows.length} student{rows.length === 1 ? "" : "s"} found{rows.length > preview.length ? ` (showing ${preview.length})` : ""}
          </p>
          <div className="overflow-x-auto border border-line rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[9px] uppercase tracking-wider text-muted border-b border-line bg-paper-warm">
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 font-medium">ID</th>
                  <th className="text-left py-2 font-medium">Grade·Sec</th>
                  <th className="text-left py-2 font-medium">Subject</th>
                  <th className="text-left py-2 px-3 font-medium">Email</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    <td className="py-2 px-3 text-ink">{[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}</td>
                    <td className="py-2 font-mono text-[11px] text-ink-soft">{r.student_id || "—"}</td>
                    <td className="py-2 text-ink-soft text-xs">{r.grade || "—"}{r.section ? `·${r.section}` : ""}</td>
                    <td className="py-2 text-ink-soft text-xs">{r.subject || "—"}</td>
                    <td className="py-2 px-3 text-ink-soft text-xs">{r.email || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
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
  subject: "",
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

// Every field in the student form says which it is: a star when it is
// required, the word "optional" when it is not. Defaulting to "optional"
// here rather than inside Field keeps the twenty other forms that share
// Field exactly as they were.
function SField({ required = false, hint, ...rest }) {
  const tag = required ? hint : hint ? `optional · ${hint}` : "optional";
  return <Field {...rest} required={required} hint={tag} />;
}

// What the form refuses to save without. `required` on a bare <input> does
// nothing here — the footer's Save is a button, not a form submit — so the
// stars would be a promise nothing kept without this list behind them.
const REQUIRED_STUDENT_FIELDS = [
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["grade", "Grade"],
  ["section", "Section"],
  // The subject is half of the delivery mechanism: work reaches a student
  // by matching the grade AND subject on this row (db/tune.sql §48). A
  // roster row without one can never receive subject-labelled work — the
  // student exists on the register and gets nothing, silently.
  ["subject", "Subject"],
  // The address is the whole of a student's identity: it is what the
  // invitation is sent to, what Google returns at sign-in, and the key the
  // roster row is claimed by. A row without one is a name that can never
  // log in, so it is required here and NOT NULL in the schema.
  ["email", "Email"],
];

function StudentEditModal({ initial, prefill = null, onClose, onSaved }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => {
    if (!initial) return { ...EMPTY_STUDENT, ...(prefill || {}) };
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

  /**
   * Addresses this teacher has used before, and what she typed with them.
   *
   * A student removed from a class does not stop existing — the account
   * survives, and so does everything she once entered about them. Making
   * her retype a date of birth the platform still holds is the kind of
   * small insult that makes software feel hostile, so the address picks
   * the rest.
   *
   * New students only. On an existing row the address is the identity of
   * the record being edited, and offering to overwrite it with someone
   * else's details is a way to lose a child in the roster.
   */
  const [known, setKnown] = useState([]);
  useEffect(() => {
    if (!isNew) return;
    api("/api/students/known").then((r) => setKnown(r || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickKnown = (email) => {
    const k = known.find((x) => (x.email || "").toLowerCase() === email.toLowerCase());
    if (!k) return set("email", email);
    setForm((f) => ({
      ...f,
      email: k.email ?? "",
      first_name: k.first_name ?? f.first_name,
      last_name: k.last_name ?? f.last_name,
      student_id: k.student_id ?? f.student_id,
      date_of_birth: k.date_of_birth ? String(k.date_of_birth).slice(0, 10) : f.date_of_birth,
      gender: k.gender ?? f.gender,
      nationality: k.nationality ?? f.nationality,
      grade: k.grade ?? f.grade,
      section: k.section ?? f.section,
      subject: k.subject ?? f.subject,
      phone: k.phone ?? f.phone,
      address: k.address ?? f.address,
      school_id: k.school_id ?? f.school_id,
      notes: k.notes ?? f.notes,
      enrollment_date: k.enrollment_date ? String(k.enrollment_date).slice(0, 10) : f.enrollment_date,
      primary_guardian_name: k.primary_guardian_name ?? f.primary_guardian_name,
      primary_guardian_relationship: k.primary_guardian_relationship ?? f.primary_guardian_relationship,
      primary_guardian_email: k.primary_guardian_email ?? f.primary_guardian_email,
      primary_guardian_phone: k.primary_guardian_phone ?? f.primary_guardian_phone,
      secondary_guardian_name: k.secondary_guardian_name ?? f.secondary_guardian_name,
      secondary_guardian_relationship: k.secondary_guardian_relationship ?? f.secondary_guardian_relationship,
      secondary_guardian_email: k.secondary_guardian_email ?? f.secondary_guardian_email,
      secondary_guardian_phone: k.secondary_guardian_phone ?? f.secondary_guardian_phone,
    }));
  };

  const knownMatch = known.find(
    (k) => (k.email || "").toLowerCase() === String(form.email || "").trim().toLowerCase()
  );

  const submit = async () => {
    const missing = REQUIRED_STUDENT_FIELDS
      .filter(([k]) => !String(form[k] ?? "").trim())
      .map(([, label]) => label);
    if (missing.length) {
      setErr(
        missing.length === 1
          ? `${missing[0]} is required.`
          : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]} are required.`
      );
      return;
    }
    // Required above; checked for shape here. A malformed address is worse
    // than a missing one — it is what the invite is sent to and what the
    // student later signs in with, and both fail silently far from here.
    const email = String(form.email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("That email address doesn't look right.");
      return;
    }
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
            {saving
              ? "Saving…"
              : !isNew
                ? "Save changes"
                /**
                 * "Create" is wrong for someone who already exists.
                 *
                 * Re-adding a student she removed is not the creation of a
                 * person — the account is there, the details are hers from
                 * last time, and nothing is being invited. Calling it Add
                 * matches what actually happens: they go back in the class.
                 */
                : knownMatch && !knownMatch.on_roster
                  ? "Add to class"
                  : "Create student"}
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
        <SField label="First name" required>
          <input className={inputClasses} value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)} required />
        </SField>
        <SField label="Last name" required>
          <input className={inputClasses} value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)} required />
        </SField>
        <SField label="Student ID">
          <input className={inputClasses} value={form.student_id}
            onChange={(e) => set("student_id", e.target.value)} />
        </SField>
        <SField label="Date of birth">
          <DatePicker value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
        </SField>
        <SField label="Gender">
          <select className={selectClasses} value={form.gender}
            onChange={(e) => set("gender", e.target.value)}>
            <option value="">—</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </SField>
        <SField label="Nationality">
          <select className={selectClasses} value={form.nationality}
            onChange={(e) => set("nationality", e.target.value)}>
            <option value="">—</option>
            {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </SField>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Class</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SField label="Grade" required>
          <select className={selectClasses} value={form.grade}
            onChange={(e) => set("grade", e.target.value)} required>
            <option value="">—</option>
            {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </SField>
        <SField label="Section" required>
          <input className={inputClasses} value={form.section}
            onChange={(e) => set("section", e.target.value)} required />
        </SField>
        {/* Required because it is half of the delivery mechanism: work
            reaches this student by matching grade + subject (§48). The
            datalist offers the standard subjects but the field stays free
            text — schools have subjects the enum has never heard of. */}
        <SField label="Subject" required hint="work is delivered by matching this">
          <input className={inputClasses} value={form.subject} list="student-subject-options"
            onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Mathematics" required />
          <datalist id="student-subject-options">
            {MAJORS.map((m) => <option key={m} value={m} />)}
          </datalist>
        </SField>
        <SField label="Enrollment date">
          <DatePicker value={form.enrollment_date} onChange={(v) => set("enrollment_date", v)} />
        </SField>
        {mySchools.length > 0 && (
          <div className={mySchools.length === 1 ? "hidden" : "md:col-span-3"}>
            <SField
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
            </SField>
          </div>
        )}
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">Contact</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <SField
          label="Email"
          hint={known.length ? "they sign in with this · or pick someone you've added before" : "they sign in with this"}
          required
        >
          <input
            type="email"
            list={known.length ? "murchid-known-students" : undefined}
            className={inputClasses}
            value={form.email}
            onChange={(e) => pickKnown(e.target.value)}
            required
          />
          {/* A datalist rather than a select: she must still be able to type
              an address that has never been used here, which is the common
              case. The list is an offer, not a constraint. */}
          {known.length > 0 && (
            <datalist id="murchid-known-students">
              {known.map((k) => (
                <option key={k.email} value={k.email}>
                  {[k.first_name, k.last_name].filter(Boolean).join(" ")}
                  {k.grade ? ` · ${k.grade}${k.section ? ` ${k.section}` : ""}` : ""}
                  {k.on_roster ? " · in your class" : " · removed"}
                </option>
              ))}
            </datalist>
          )}
          {knownMatch && (
            <p className="text-xs mt-1.5 text-muted">
              {knownMatch.on_roster ? (
                <span className="text-clay">
                  {[knownMatch.first_name, knownMatch.last_name].filter(Boolean).join(" ")} is
                  already in your class — find them in the list to edit instead.
                </span>
              ) : knownMatch.has_account ? (
                <>
                  You removed{" "}
                  <span className="text-ink">
                    {[knownMatch.first_name, knownMatch.last_name].filter(Boolean).join(" ")}
                  </span>{" "}
                  before, and they already have an account.{" "}
                  <span className="text-ink">No invitation will be sent</span> — they rejoin your
                  class the moment you save.
                </>
              ) : (
                <>Filled in from the last time you added this student. They&rsquo;ll be invited on save.</>
              )}
            </p>
          )}
        </SField>
        <SField label="Phone">
          <input className={inputClasses} value={form.phone}
            onChange={(e) => set("phone", e.target.value)} />
        </SField>
        <div className="md:col-span-2">
          <SField label="Address">
            <input className={inputClasses} value={form.address}
              onChange={(e) => set("address", e.target.value)} />
          </SField>
        </div>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
        Primary guardian
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <SField label="Name">
          <input className={inputClasses} value={form.primary_guardian_name}
            onChange={(e) => set("primary_guardian_name", e.target.value)} />
        </SField>
        <SField label="Relationship">
          <input className={inputClasses} value={form.primary_guardian_relationship}
            onChange={(e) => set("primary_guardian_relationship", e.target.value)} />
        </SField>
        <SField label="Email">
          <input type="email" className={inputClasses} value={form.primary_guardian_email}
            onChange={(e) => set("primary_guardian_email", e.target.value)} />
        </SField>
        <SField label="Phone">
          <input className={inputClasses} value={form.primary_guardian_phone}
            onChange={(e) => set("primary_guardian_phone", e.target.value)} />
        </SField>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">
        Secondary guardian (optional)
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <SField label="Name">
          <input className={inputClasses} value={form.secondary_guardian_name}
            onChange={(e) => set("secondary_guardian_name", e.target.value)} />
        </SField>
        <SField label="Relationship">
          <input className={inputClasses} value={form.secondary_guardian_relationship}
            onChange={(e) => set("secondary_guardian_relationship", e.target.value)} />
        </SField>
        <SField label="Email">
          <input type="email" className={inputClasses} value={form.secondary_guardian_email}
            onChange={(e) => set("secondary_guardian_email", e.target.value)} />
        </SField>
        <SField label="Phone">
          <input className={inputClasses} value={form.secondary_guardian_phone}
            onChange={(e) => set("secondary_guardian_phone", e.target.value)} />
        </SField>
      </div>

      <SField label="Notes">
        <textarea rows={2} className={inputClasses} value={form.notes}
          onChange={(e) => set("notes", e.target.value)} />
      </SField>
    </Modal>
  );
}
