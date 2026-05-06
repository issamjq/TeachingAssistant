import React, { useEffect, useState } from "react";
import { Plus, Pause, Play, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Field, Modal, ConfirmDelete, RowActions,
  inputClasses, selectClasses, api,
} from "./_shared";

const STATUS_LABEL = {
  active: "Active",
  suspended: "Suspended",
  deleted: "Deleted",
};

export default function AdminConsole() {
  const [stats, setStats] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([api("/api/admin/stats"), api("/api/admin/teachers")])
      .then(([s, t]) => { setStats(s); setTeachers(t); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  };
  useEffect(reload, []);

  const setStatus = async (t, status) => {
    await api(`/api/admin/teachers/${t.id}/status`, { method: "PATCH", body: { status } });
    reload();
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/teachers/${deleting.id}`, { method: "DELETE" });
      setTeachers((rows) => rows.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      alert(`Could not delete: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const onCreated = (saved) => {
    setTeachers((rows) => [saved, ...rows]);
    setEditing(null);
  };

  return (
    <div>
      <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> Admin
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Admin <em className="italic font-light text-accent">console</em>
          </h2>
          <p className="text-muted mt-2">
            Manage teacher accounts. You cannot see any teacher&rsquo;s lessons, students, or content.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus size={15} className="mr-2" /> New teacher
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent">{error}</p>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            ["Active teachers", stats.active_teachers],
            ["Suspended", stats.suspended_teachers],
            ["Students (system-wide)", stats.total_students],
            ["Lesson plans", stats.total_lessons],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-3">{label}</p>
                <p className="font-serif text-5xl font-medium text-accent leading-none">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border-b border-line">
                  <th className="text-left py-3 px-5 font-medium">Teacher</th>
                  <th className="text-left py-3 font-medium">Email</th>
                  <th className="text-left py-3 font-medium">Staff ID</th>
                  <th className="text-left py-3 font-medium">Role</th>
                  <th className="text-left py-3 font-medium">Status</th>
                  <th className="text-left py-3 font-medium">Workload</th>
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} className="border-b border-line/60 last:border-0 hover:bg-paper-warm transition">
                    <td className="py-3 px-5 text-ink">{t.first_name} {t.last_name}</td>
                    <td className="py-3 text-muted text-xs">{t.email || "—"}</td>
                    <td className="py-3 font-mono text-[11px] text-ink-soft">{t.staff_id || "—"}</td>
                    <td className="py-3 text-ink-soft text-xs">{t.role}</td>
                    <td className="py-3">
                      <span className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        t.status === "active"    ? "border-sage text-sage bg-paper" :
                        t.status === "suspended" ? "border-gold text-gold bg-paper" :
                                                   "border-accent text-accent bg-paper"
                      }`}>
                        {STATUS_LABEL[t.status] || t.status}
                      </span>
                    </td>
                    <td className="py-3 text-muted text-xs">
                      {t.students} students · {t.drafts} lessons
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-1">
                        {t.status === "suspended" ? (
                          <button onClick={() => setStatus(t, "active")} title="Reactivate"
                            className="h-7 w-7 rounded-md border border-line hover:border-ink hover:bg-paper-warm flex items-center justify-center text-ink-soft transition">
                            <Play size={12} />
                          </button>
                        ) : (
                          <button onClick={() => setStatus(t, "suspended")} title="Suspend"
                            className="h-7 w-7 rounded-md border border-line hover:border-gold hover:bg-paper-warm flex items-center justify-center text-ink-soft transition">
                            <Pause size={12} />
                          </button>
                        )}
                        <button onClick={() => setDeleting(t)} title="Delete"
                          className="h-7 w-7 rounded-md border border-line hover:border-accent hover:bg-paper-warm flex items-center justify-center text-ink-soft hover:text-accent transition">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && teachers.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-muted">No teachers yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <NewTeacherModal onClose={() => setEditing(null)} onSaved={onCreated} />
      )}

      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={deleting ? `Delete ${deleting.first_name} ${deleting.last_name}?` : ""}
        message="The teacher account and ALL their content (lessons, students, etc.) will be removed."
      />
    </div>
  );
}

function NewTeacherModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    staff_id: "",
    role: "teacher",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const saved = await api("/api/admin/teachers", { method: "POST", body: form });
      onSaved(saved);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      open onClose={onClose}
      eyebrow="New teacher"
      title="Create a teacher account"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
        </>
      }
    >
      {err && <div className="mb-4 bg-paper border border-accent rounded-lg p-3"><p className="text-sm text-accent">{err}</p></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First name">
          <input className={inputClasses} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
        </Field>
        <Field label="Last name">
          <input className={inputClasses} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" className={inputClasses} value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Staff ID">
          <input className={inputClasses} value={form.staff_id} onChange={(e) => set("staff_id", e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Role">
            <select className={selectClasses} value={form.role} onChange={(e) => set("role", e.target.value)}>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
              <option value="dev">Dev</option>
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
