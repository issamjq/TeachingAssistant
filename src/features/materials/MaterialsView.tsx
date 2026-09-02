"use client";

// My material — the shelf.
//
// Files uploaded in the studio or the goal planner have always been
// stored; nothing ever showed them back. So the same textbook chapter
// was uploaded again for every lesson, and charged for again each time,
// because the read is priced per request that carries an attachment.
//
// This is the other half: what she has, what it is bound to, and whether
// the service has managed to read it.

import React, { useEffect, useMemo, useState } from "react";
import { FileText, Search, Trash2, Pencil, Check, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Modal, ConfirmDelete, inputClasses, selectClasses } from "@/views/_shared";
import BrandLoader from "@/components/BrandLoader";
import { flash } from "@/shared/lib/flash";
import { GRADE_LEVELS, MAJORS, QUIZ_SECTIONS } from "@/lib/enums";
import {
  listMaterials, updateMaterial, deleteMaterial, uploadMaterial,
  materialLabel, type Material,
} from "./api";

const KINDS = [
  { value: "textbook", label: "Textbook" },
  { value: "syllabus", label: "Syllabus" },
  { value: "notes", label: "Notes" },
  { value: "other", label: "Other" },
];

/**
 * What the service has managed to do with the file.
 *
 * Said plainly rather than hidden: a file it could not read still
 * attaches, and the generation simply happens without it — so a teacher
 * who can see "couldn't read this" understands a thin lesson instead of
 * blaming the model.
 */
function ReadState({ status }: { status: string | null }) {
  if (status === "ready") {
    return <span className="font-mono text-[10px] uppercase tracking-wider text-ok">Read</span>;
  }
  if (status === "failed") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-accent"
            title="Murchid could not pull text out of this file. It can still be attached; the lesson is written without it.">
        Couldn&apos;t read
      </span>
    );
  }
  if (status === "processing") {
    return <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Reading…</span>;
  }
  return <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Stored</span>;
}

const sizeLine = (m: Material) =>
  [m.pages ? `${m.pages} page${m.pages === 1 ? "" : "s"}` : null,
   m.kind ? KINDS.find((k) => k.value === m.kind)?.label : null].filter(Boolean).join(" · ");

const classLine = (m: Material) => {
  const bits = [m.grade, m.section, m.subject].filter(Boolean);
  return bits.length ? bits.join(" · ") : "Any class";
};

export default function MaterialsView() {
  // null = not loaded yet, so "loading" is derived rather than a second
  // flag an effect has to set synchronously.
  const [rows, setRows] = useState<Material[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loading = rows === null;
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [editing, setEditing] = useState<Material | null>(null);
  const [removing, setRemoving] = useState<Material | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reload = () => setReloadKey((n) => n + 1);

  useEffect(() => {
    let live = true;
    listMaterials()
      .then((r) => { if (live) setRows(r || []); })
      .catch((e) => { if (live) { setError(e.message); setRows([]); } });
    return () => { live = false; };
  }, [reloadKey]);

  const shown = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!rows) return [];
    if (!t) return rows;
    return rows.filter((m) =>
      `${materialLabel(m)} ${m.subject || ""} ${m.grade || ""}`.toLowerCase().includes(t));
  }, [rows, term]);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) await uploadMaterial(f, { where: "shelf" });
      reload();
    } catch (err: any) {
      flash(err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async (patch: Partial<Material>) => {
    if (!editing) return;
    setBusy(true);
    try {
      await updateMaterial(editing.id, patch);
      setEditing(null);
      reload();
    } catch (e: any) {
      flash(`Could not save: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteMaterial(removing.id);
      setRemoving(null);
      reload();
    } catch (e: any) {
      flash(`Could not remove: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1.5">
            My material
          </p>
          <h1 className="font-serif text-2xl leading-tight">
            Your <em className="text-accent">books and notes</em>
          </h1>
          <p className="text-[13px] text-muted mt-1.5 max-w-[52ch]">
            Upload a textbook or a syllabus once and attach it whenever you
            make something. Murchid reads it the first time, so it costs
            nothing to use again.
          </p>
        </div>
        <label className="inline-flex">
          <input
            type="file"
            multiple
            className="sr-only"
            onChange={onFiles}
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,image/*"
          />
          <span
            role="button"
            tabIndex={0}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-ink text-paper text-sm font-medium cursor-pointer"
          >
            <Upload size={15} aria-hidden />
            {uploading ? "Uploading…" : "Add material"}
          </span>
        </label>
      </div>

      {!!rows?.length && (
        <div className="relative mb-4 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search your material"
            aria-label="Search your material"
            className={`${inputClasses} pl-9`}
          />
        </div>
      )}

      {loading ? (
        <BrandLoader />
      ) : error ? (
        <Card><CardContent><p className="text-sm text-accent">{error}</p></CardContent></Card>
      ) : !rows?.length ? (
        <Card>
          <CardContent>
            <p className="font-serif text-lg mb-1">Nothing here yet.</p>
            <p className="text-[13px] text-muted max-w-[46ch]">
              Add the textbook or syllabus you teach from. Anything you attach
              in the Studio lands here too, so you only ever upload it once.
            </p>
          </CardContent>
        </Card>
      ) : !shown.length ? (
        <Card><CardContent><p className="text-sm text-muted">Nothing matches “{term}”.</p></CardContent></Card>
      ) : (
        <div className="grid gap-2.5">
          {shown.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-start gap-3 py-3.5">
                <FileText size={17} className="flex-none mt-0.5 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{materialLabel(m)}</p>
                  <p className="text-[12px] text-muted mt-0.5 truncate">
                    {classLine(m)}
                    {sizeLine(m) ? ` · ${sizeLine(m)}` : ""}
                  </p>
                </div>
                <div className="flex-none flex items-center gap-3">
                  <ReadState status={m.status} />
                  <button
                    type="button"
                    onClick={() => setEditing(m)}
                    aria-label={`Edit ${materialLabel(m)}`}
                    className="text-muted hover:text-ink"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoving(m)}
                    aria-label={`Remove ${materialLabel(m)}`}
                    className="text-muted hover:text-accent"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <EditMaterial
          material={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}

      <ConfirmDelete
        open={!!removing}
        title="Remove this material?"
        message={
          removing
            ? `“${materialLabel(removing)}” goes to the trash. Anything you already made with it is untouched.`
            : ""
        }
        busy={busy}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
      />
    </div>
  );
}

function EditMaterial({
  material, busy, onCancel, onSave,
}: {
  material: Material;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: Partial<Material>) => void;
}) {
  const [form, setForm] = useState({
    title: material.title || material.file_name,
    kind: material.kind || "",
    grade: material.grade || "",
    section: material.section || "",
    subject: material.subject || "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open
      title="Edit material"
      eyebrow="My material"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={() => onSave(form as Partial<Material>)} disabled={busy}>
            <Check size={14} /> {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3.5">
        <Field label="Name">
          <input
            className={inputClasses}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={material.file_name}
            autoFocus
          />
        </Field>
        <Field label="What is it" hint="optional">
          <select className={selectClasses} value={form.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="">—</option>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </Field>
        {/* Bound to a class, because 6A and 6B may work from different
            notes. Blank means it is offered for everything. */}
        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Grade" hint="optional">
            <select className={selectClasses} value={form.grade} onChange={(e) => set("grade", e.target.value)}>
              <option value="">Any</option>
              {GRADE_LEVELS.map((g: string) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Section" hint="optional">
            <select className={selectClasses} value={form.section} onChange={(e) => set("section", e.target.value)}>
              <option value="">Any</option>
              {QUIZ_SECTIONS.map((s: string) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Subject" hint="optional">
            <select className={selectClasses} value={form.subject} onChange={(e) => set("subject", e.target.value)}>
              <option value="">Any</option>
              {MAJORS.map((s: string) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
