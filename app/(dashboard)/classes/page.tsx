"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

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
  createGrade,
  createDivision,
  createClass,
  type BatchRow,
} from "@/lib/data/classes";

export default function ClassesPage() {
  const { user } = useSession();
  const { bump } = useClassesRefresh();
  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          <Tabs defaultValue={batches[0].id}>
            <TabsList>
              {batches.map((b) => (
                <TabsTrigger key={b.id} value={b.id}>
                  {b.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {batches.map((batch) => (
              <TabsContent key={batch.id} value={batch.id} className="space-y-6">
                <BatchGrades batch={batch} ownerId={ownerId} onChanged={refresh} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}

function BatchGrades({
  batch,
  ownerId,
  onChanged,
}: {
  batch: BatchRow;
  ownerId: string;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-6">
      {batch.grades
        .slice()
        .sort((a, b) => a.level - b.level)
        .map((grade) => (
          <div key={grade.id} className="space-y-3">
            <h2 className="text-sm font-semibold">Grade {grade.level}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grade.divisions.map((division) => (
                <Card key={division.id}>
                  <CardContent className="space-y-2 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Division {division.label}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {division.classes.map((c) => (
                        <Link
                          key={c.id}
                          href={`/classes/${c.id}`}
                          className="rounded-md border border-border px-2.5 py-1 text-sm hover:border-primary hover:text-primary"
                        >
                          {c.subject}
                        </Link>
                      ))}
                      <AddSubjectForm
                        ownerId={ownerId}
                        divisionId={division.id}
                        onAdded={onChanged}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
              <AddDivisionCard ownerId={ownerId} gradeId={grade.id} onAdded={onChanged} />
            </div>
          </div>
        ))}
      <AddGradeForm ownerId={ownerId} batchId={batch.id} onAdded={onChanged} />
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
