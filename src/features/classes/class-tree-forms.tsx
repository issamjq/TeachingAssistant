"use client";

import { useState } from "react";
import { Plus, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconButton } from "./icon-button";
import { createBatch, createGrade, createDivision, createClass } from "@/lib/data/classes";

function academicYearOptions(): { label: string; startYear: number }[] {
  const now = new Date().getFullYear();
  const options = [];
  for (let y = now - 1; y <= now + 3; y++) {
    options.push({ label: `${y}-${String(y + 1).slice(-2)}`, startYear: y });
  }
  return options;
}

const CUSTOM_VALUE = "__custom__";

export function AddBatchForm({ ownerId, onAdded }: { ownerId: string; onAdded: () => void }) {
  const options = academicYearOptions();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(options[1]?.label ?? CUSTOM_VALUE);
  const [customLabel, setCustomLabel] = useState("");
  const [customYear, setCustomYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus /> New batch
      </Button>
    );
  }

  const isCustom = selected === CUSTOM_VALUE;

  async function submit() {
    const label = isCustom ? customLabel.trim() : selected;
    const startYear = isCustom
      ? customYear
      : (options.find((o) => o.label === selected)?.startYear ?? customYear);
    if (!label) return;
    setSaving(true);
    await createBatch(ownerId, label, startYear);
    setSaving(false);
    setOpen(false);
    setCustomLabel("");
    onAdded();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="flex h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((o) => (
          <option key={o.label} value={o.label}>
            {o.label}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>Custom…</option>
      </select>
      {isCustom ? (
        <>
          <Input
            placeholder="e.g. 2030-31"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            className="h-8 w-28"
            autoFocus
          />
          <Input
            type="number"
            value={customYear}
            onChange={(e) => setCustomYear(Number(e.target.value))}
            className="h-8 w-20"
          />
        </>
      ) : null}
      <Button size="sm" onClick={submit} disabled={saving}>
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

export function AddGradeForm({
  ownerId,
  batchId,
  onAdded,
}: {
  ownerId: string;
  batchId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState(9);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus /> Add grade
      </Button>
    );
  }

  async function submit() {
    setSaving(true);
    await createGrade(ownerId, batchId, level);
    setSaving(false);
    setOpen(false);
    onAdded();
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={level}
        onChange={(e) => setLevel(Number(e.target.value))}
        className="h-8 w-20"
      />
      <Button size="sm" onClick={submit} disabled={saving}>
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

export function AddDivisionCard({
  ownerId,
  gradeId,
  onAdded,
}: {
  ownerId: string;
  gradeId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label.trim()) return;
    setSaving(true);
    await createDivision(ownerId, gradeId, label.trim());
    setSaving(false);
    setOpen(false);
    setLabel("");
    onAdded();
  }

  return (
    <div className="flex min-h-[86px] items-center justify-center rounded-2xl border border-dashed border-border p-4">
      {open ? (
        <div className="flex items-center gap-2">
          <Input
            placeholder="D"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-8 w-16"
            autoFocus
          />
          <Button size="sm" onClick={submit} disabled={saving}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Plus /> Add division
        </Button>
      )}
    </div>
  );
}

export function AddSubjectForm({
  ownerId,
  divisionId,
  onAdded,
}: {
  ownerId: string;
  divisionId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-xl border border-dashed border-border py-2 pl-2.5 pr-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="size-3.5" /> Subject
      </button>
    );
  }

  async function submit() {
    if (!subject.trim()) return;
    setSaving(true);
    await createClass(ownerId, divisionId, subject.trim());
    setSaving(false);
    setOpen(false);
    setSubject("");
    onAdded();
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1.5">
      <Input
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="h-7 w-28"
        autoFocus
      />
      <IconButton title="Add" onClick={submit} disabled={saving}>
        <Check className="size-3.5" />
      </IconButton>
      <IconButton title="Cancel" onClick={() => setOpen(false)}>
        <X className="size-3.5" />
      </IconButton>
    </div>
  );
}
