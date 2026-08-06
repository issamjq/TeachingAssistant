"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import {
  Field, inputClasses, selectClasses, api, DatePicker,
} from "./_shared";
import { activityToDoc } from "../lib/toDoc";
import { useT } from "../lib/i18n";

// Full-page activity builder — same routed pattern as QuizBuilder. The
// Activities list routes by id, so when an id is present we re-fetch the
// full row and seed the form from the server. A brand-new activity has no
// id until the first save.
export default function ActivityBuilder({ activity, onClose }) {
  const t = useT();
  const [acId, setAcId] = useState(activity?.id || null);
  const [form, setForm] = useState({
    title: activity?.title || "",
    type: activity?.type || "individual",
    subject: activity?.subject || "",
    duration_minutes: activity?.duration_minutes || 15,
    scheduled_for: activity?.scheduled_for ? String(activity.scheduled_for).slice(0, 10) : "",
    instructions: activity?.instructions || "",
    materials: Array.isArray(activity?.materials) ? activity.materials : [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!acId) return;
    api(`/api/activities/${acId}`).then((row) => {
      if (!row) return;
      setForm({
        title: row.title || "",
        type: row.type || "individual",
        subject: row.subject || "",
        duration_minutes: row.duration_minutes ?? 15,
        scheduled_for: row.scheduled_for ? String(row.scheduled_for).slice(0, 10) : "",
        instructions: row.instructions || "",
        materials: Array.isArray(row.materials) ? row.materials : [],
      });
    }).catch(() => {});
  }, [acId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(null);
    // Empty date → null so Postgres doesn't try to cast "" to DATE.
    const payload = { ...form, scheduled_for: form.scheduled_for || null };
    try {
      const saved = acId
        ? await api(`/api/activities/${acId}`, { method: "PATCH", body: payload })
        : await api(`/api/activities`, { method: "POST", body: payload });
      setAcId(saved.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2 inline-flex items-center gap-2.5">
            <span className="w-6 h-px bg-accent" /> {acId ? "Edit activity" : "New activity"}
          </p>
          <h2 className="font-serif text-4xl font-medium text-ink">
            {acId ? form.title || "Untitled activity" : <>Plan an <em className="italic font-light text-accent">activity</em></>}
          </h2>
        </div>
        <div className="flex gap-3 items-center">
          {acId && (
            <ExportMenu formats={["pdf"]} buildDoc={() => activityToDoc(form, t)} />
          )}
          <Button variant="secondary" onClick={onClose}>Back to activities</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : acId ? "Save changes" : "Create activity"}
          </Button>
        </div>
      </div>

      {err && (
        <div className="mb-4 bg-paper border border-accent rounded-lg p-3">
          <p className="text-sm text-accent">{err}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-4">Activity details</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Title">
                <input className={inputClasses} value={form.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
            </div>
            <Field label="Type">
              <select className={selectClasses} value={form.type} onChange={(e) => set("type", e.target.value)}>
                <option value="individual">Individual</option>
                <option value="pair">Pair</option>
                <option value="group">Group</option>
              </select>
            </Field>
            <Field label="Duration (minutes)">
              <input type="number" className={inputClasses} value={form.duration_minutes ?? ""} onChange={(e) => set("duration_minutes", e.target.value === "" ? null : Number(e.target.value))} />
            </Field>
            <Field label="Subject">
              <input className={inputClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </Field>
            <Field label="Scheduled for">
              <DatePicker value={form.scheduled_for} onChange={(v) => set("scheduled_for", v)} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Instructions">
                <textarea rows={4} className={inputClasses} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
