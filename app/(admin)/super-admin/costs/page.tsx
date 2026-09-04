"use client";

import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { listFeatureCosts, updateFeatureCost, type FeatureCostRow } from "@/lib/data/superadmin";

const FEATURE_LABEL: Record<string, string> = {
  lesson_plan: "Lesson plans",
  slide_deck: "Presentations",
  activity: "Activities",
  homework: "Homework",
  note: "Notes & text",
  quiz: "Quizzes",
  exam: "Exams",
};

export default function SuperAdminCostsPage() {
  const [rows, setRows] = useState<FeatureCostRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingFeature, setSavingFeature] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listFeatureCosts().then((r) => {
      setRows(r);
      setDrafts(Object.fromEntries(r.map((row) => [row.feature, String(row.credit_cost)])));
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save(feature: string) {
    const value = Number(drafts[feature]);
    if (!Number.isFinite(value) || value < 0) return;
    setSavingFeature(feature);
    try {
      await updateFeatureCost(feature, value);
      refresh();
    } finally {
      setSavingFeature(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Feature costs"
        description="Real, editable pricing policy — nothing deducts credits against it yet, since there's no live credits/billing system to charge."
      />
      <div className="p-6 md:p-8">
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {rows.map((row) => (
                <div key={row.feature} className="flex items-center justify-between gap-4 p-4">
                  <p className="text-sm font-medium">
                    {FEATURE_LABEL[row.feature] ?? row.feature}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={drafts[row.feature] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [row.feature]: e.target.value }))
                      }
                      className="h-8 w-20 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">credits</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        savingFeature === row.feature ||
                        drafts[row.feature] === String(row.credit_cost)
                      }
                      onClick={() => save(row.feature)}
                    >
                      {savingFeature === row.feature ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
