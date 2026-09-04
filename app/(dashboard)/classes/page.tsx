"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useSession } from "@/features/auth/session-context";
import { useClassesRefresh } from "@/features/classes/classes-refresh-context";
import {
  listHierarchy,
  createBatch,
  updateBatch,
  deleteBatch,
  createGrade,
  updateGrade,
  deleteGrade,
  createDivision,
  updateDivision,
  deleteDivision,
  createClass,
  updateClass,
  deleteClass,
  type BatchRow,
} from "@/lib/data/classes";

export default function ClassesPage() {
  const { user } = useSession();
  const { bump } = useClassesRefresh();
  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<string | undefined>(undefined);

  const refresh = useCallback(() => {
    listHierarchy()
      .then(setBatches)
      .catch((e) => setError(e.message ?? "Failed to load classes"));
    bump();
  }, [bump]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) return null;
  const ownerId = user.id;

  if (error) {
    return (
      <div>
        <PageHeader title="My Classes" description="Batch → Grade → Division → Subject." />
        <div className="p-6 md:p-8">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  if (batches === null) {
    return (
      <div>
        <PageHeader title="My Classes" description="Batch → Grade → Division → Subject." />
        <div className="p-6 text-sm text-muted-foreground md:p-8">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Classes"
        description="Batch → Grade → Division → Subject."
        action={<AddBatchForm ownerId={ownerId} onAdded={refresh} />}
      />
      <div className="p-6 md:p-8">
        {batches.length === 0 ? (
          <EmptyState
            title="No classes yet"
            description="Start by adding a batch (a school year, e.g. 2025-26) — grades, divisions, and subjects nest under it."
          />
        ) : (
          <Tabs value={activeBatch ?? batches[0].id} onValueChange={setActiveBatch}>
            <TabsList>
              {batches.map((b) => (
                <TabsTrigger key={b.id} value={b.id}>
                  {b.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {batches.map((batch) => (
              <TabsContent key={batch.id} value={batch.id} className="space-y-6">
                <BatchDetail
                  batch={batch}
                  ownerId={ownerId}
                  onChanged={refresh}
                  onDeleted={() => setActiveBatch(undefined)}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}

function IconButton({
  onClick,
  title,
  variant = "ghost",
  children,
}: {
  onClick: () => void;
  title: string;
  variant?: "ghost" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        variant === "destructive"
          ? "rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }
    >
      {children}
    </button>
  );
}

function BatchDetail({
  batch,
  ownerId,
  onChanged,
  onDeleted,
}: {
  batch: BatchRow;
  ownerId: string;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(batch.label);
  const [startYear, setStartYear] = useState(batch.start_year);
  const [saving, setSaving] = useState(false);

  async function saveEdit() {
    if (!label.trim()) return;
    setSaving(true);
    await updateBatch(batch.id, label.trim(), startYear);
    setSaving(false);
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete batch "${batch.label}"? This removes every grade, division, and subject under it.`)) return;
    await deleteBatch(batch.id);
    onDeleted();
    onChanged();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 w-28" autoFocus />
            <Input
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
              className="h-8 w-20"
            />
            <IconButton title="Save" onClick={saveEdit}>
              <Check className="size-4" />
            </IconButton>
            <IconButton title="Cancel" onClick={() => setEditing(false)}>
              <X className="size-4" />
            </IconButton>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold">{batch.label}</h2>
            <IconButton title="Rename batch" onClick={() => setEditing(true)} >
              <Pencil className="size-3.5" />
            </IconButton>
            <IconButton title="Delete batch" variant="destructive" onClick={remove}>
              <Trash2 className="size-3.5" />
            </IconButton>
          </>
        )}
        {saving ? <span className="text-xs text-muted-foreground">Saving…</span> : null}
      </div>

      {batch.grades
        .slice()
        .sort((a, b) => a.level - b.level)
        .map((grade) => (
          <GradeSection key={grade.id} grade={grade} ownerId={ownerId} onChanged={onChanged} />
        ))}
      <AddGradeForm ownerId={ownerId} batchId={batch.id} onAdded={onChanged} />
    </div>
  );
}

function GradeSection({
  grade,
  ownerId,
  onChanged,
}: {
  grade: BatchRow["grades"][number];
  ownerId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [level, setLevel] = useState(grade.level);

  async function saveEdit() {
    await updateGrade(grade.id, level);
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete Grade ${grade.level}? This removes every division and subject under it.`)) return;
    await deleteGrade(grade.id);
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Input
              type="number"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="h-7 w-16"
              autoFocus
            />
            <IconButton title="Save" onClick={saveEdit}>
              <Check className="size-3.5" />
            </IconButton>
            <IconButton title="Cancel" onClick={() => setEditing(false)}>
              <X className="size-3.5" />
            </IconButton>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold">Grade {grade.level}</h2>
            <IconButton title="Edit grade" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
            </IconButton>
            <IconButton title="Delete grade" variant="destructive" onClick={remove}>
              <Trash2 className="size-3.5" />
            </IconButton>
          </>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grade.divisions.map((division) => (
          <DivisionCard
            key={division.id}
            division={division}
            ownerId={ownerId}
            onChanged={onChanged}
          />
        ))}
        <AddDivisionCard ownerId={ownerId} gradeId={grade.id} onAdded={onChanged} />
      </div>
    </div>
  );
}

function DivisionCard({
  division,
  ownerId,
  onChanged,
}: {
  division: BatchRow["grades"][number]["divisions"][number];
  ownerId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(division.label);

  async function saveEdit() {
    if (!label.trim()) return;
    await updateDivision(division.id, label.trim());
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete Division ${division.label}? This removes every subject under it.`)) return;
    await deleteDivision(division.id);
    onChanged();
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-7 w-16" autoFocus />
              <IconButton title="Save" onClick={saveEdit}>
                <Check className="size-3.5" />
              </IconButton>
              <IconButton title="Cancel" onClick={() => setEditing(false)}>
                <X className="size-3.5" />
              </IconButton>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Division {division.label}
              </p>
              <IconButton title="Edit division" onClick={() => setEditing(true)}>
                <Pencil className="size-3" />
              </IconButton>
              <IconButton title="Delete division" variant="destructive" onClick={remove}>
                <Trash2 className="size-3" />
              </IconButton>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {division.classes.map((c) => (
            <SubjectChip key={c.id} classRow={c} onChanged={onChanged} />
          ))}
          <AddSubjectForm ownerId={ownerId} divisionId={division.id} onAdded={onChanged} />
        </div>
      </CardContent>
    </Card>
  );
}

function SubjectChip({
  classRow,
  onChanged,
}: {
  classRow: { id: string; subject: string };
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(classRow.subject);

  async function saveEdit() {
    if (!subject.trim()) return;
    await updateClass(classRow.id, subject.trim());
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete "${classRow.subject}"? This removes its lessons, notes, and results.`)) return;
    await deleteClass(classRow.id);
    onChanged();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8 w-28" autoFocus />
        <IconButton title="Save" onClick={saveEdit}>
          <Check className="size-3.5" />
        </IconButton>
        <IconButton title="Cancel" onClick={() => setEditing(false)}>
          <X className="size-3.5" />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-0.5 rounded-md border border-border pl-2.5 pr-1 hover:border-primary">
      <Link href={`/classes/${classRow.id}`} className="py-1 text-sm hover:text-primary">
        {classRow.subject}
      </Link>
      <IconButton title="Rename subject" onClick={() => setEditing(true)}>
        <Pencil className="size-3" />
      </IconButton>
      <IconButton title="Delete subject" variant="destructive" onClick={remove}>
        <Trash2 className="size-3" />
      </IconButton>
    </div>
  );
}

function academicYearOptions(): { label: string; startYear: number }[] {
  const now = new Date().getFullYear();
  const options = [];
  for (let y = now - 1; y <= now + 3; y++) {
    options.push({ label: `${y}-${String(y + 1).slice(-2)}`, startYear: y });
  }
  return options;
}

const CUSTOM_VALUE = "__custom__";

function AddBatchForm({ ownerId, onAdded }: { ownerId: string; onAdded: () => void }) {
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

function AddGradeForm({
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

function AddDivisionCard({
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
    <Card className="border-dashed">
      <CardContent className="flex items-center justify-center p-4">
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
      </CardContent>
    </Card>
  );
}

function AddSubjectForm({
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
        className="rounded-md border border-dashed border-border px-2.5 py-1 text-sm text-muted-foreground hover:border-primary hover:text-primary"
      >
        <Plus className="inline size-3.5" /> Subject
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
    <div className="flex items-center gap-1">
      <Input
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="h-8 w-28"
        autoFocus
      />
      <Button size="sm" onClick={submit} disabled={saving}>
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        ×
      </Button>
    </div>
  );
}
