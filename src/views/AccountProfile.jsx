import React, { useState, useEffect } from "react";
import { Mail, Phone, Globe, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NATIONALITIES } from "../lib/enums";
import { Field, Modal, inputClasses, selectClasses, api } from "./_shared";

const initials = (first, last) =>
  `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase();

export default function AccountProfile() {
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
            <span className="w-6 h-px bg-accent" /> Account
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            Personal <em className="italic font-light text-accent">details</em>
          </h2>
          <p className="text-muted mt-2">
            How the school reaches you. Work details (majors, grades, hire date) live in Class roster.
          </p>
        </div>
        {me && (
          <Button onClick={() => setEditing(true)}>
            <Pencil size={14} className="mr-2" /> Edit account
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1">
            Could not load your account
          </p>
          <p className="text-sm text-ink-soft">{error}</p>
        </div>
      )}

      {loading && (
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
          Loading account from Neon…
        </p>
      )}

      {me && (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center gap-5 mb-6">
              <div className="h-16 w-16 rounded-full bg-paper-warm border border-line flex items-center justify-center font-mono text-base tracking-wider text-ink-soft flex-shrink-0">
                {initials(me.first_name, me.last_name)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-3xl text-ink leading-tight">
                  {me.first_name} {me.last_name}
                </h3>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted mt-1.5">
                  Teacher
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 pt-6 border-t border-line">
              <Stat label="Email" value={me.email || "—"} icon={<Mail size={13} />} />
              <Stat label="Phone" value={me.phone || "—"} icon={<Phone size={13} />} mono />
              <Stat label="Nationality" value={me.nationality || "—"} icon={<Globe size={13} />} />
            </div>
          </CardContent>
        </Card>
      )}

      {editing && (
        <AccountEditModal initial={me} onClose={() => setEditing(false)} onSaved={onSaved} />
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

function AccountEditModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: initial.first_name || "",
    last_name: initial.last_name || "",
    email: initial.email || "",
    phone: initial.phone || "",
    nationality: initial.nationality || "",
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
      eyebrow="Edit account"
      title="Update your details"
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
        <Field label="First name">
          <input
            className={inputClasses}
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
          />
        </Field>
        <Field label="Last name">
          <input
            className={inputClasses}
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={inputClasses}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputClasses}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Nationality">
            <select
              className={selectClasses}
              value={form.nationality || ""}
              onChange={(e) => set("nationality", e.target.value)}
            >
              <option value="">—</option>
              {NATIONALITIES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
