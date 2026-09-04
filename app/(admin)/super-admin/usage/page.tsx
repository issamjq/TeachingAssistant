"use client";

import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listAllAccounts,
  listGenerationEvents,
  listFeatureCosts,
  type AccountRow,
  type AnalyticsEventRow,
  type FeatureCostRow,
} from "@/lib/data/superadmin";

const FEATURE_LABEL: Record<string, string> = {
  lesson_plan: "Lesson plans",
  slide_deck: "Presentations",
  activity: "Activities",
  homework: "Homework",
  note: "Notes & text",
  quiz: "Quizzes",
  exam: "Exams",
};

export default function SuperAdminUsagePage() {
  const [events, setEvents] = useState<AnalyticsEventRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [costs, setCosts] = useState<FeatureCostRow[] | null>(null);

  useEffect(() => {
    listGenerationEvents().then(setEvents);
    listAllAccounts().then(setAccounts);
    listFeatureCosts().then(setCosts);
  }, []);

  const byFeature = new Map<string, number>();
  const byOwner = new Map<string, number>();
  for (const e of events ?? []) {
    if (e.feature) byFeature.set(e.feature, (byFeature.get(e.feature) ?? 0) + 1);
    byOwner.set(e.owner_id, (byOwner.get(e.owner_id) ?? 0) + 1);
  }
  const costByFeature = new Map((costs ?? []).map((c) => [c.feature, c.credit_cost]));
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));

  const topOwners = Array.from(byOwner.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const projectedCredits = Array.from(byFeature.entries()).reduce(
    (sum, [feature, count]) => sum + count * (costByFeature.get(feature) ?? 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title="AI usage & credits"
        description="Real counts of generation requests — the drafted content itself is still simulated, no live model call is wired up yet."
      />
      <div className="space-y-6 p-6 md:p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard label="Generation requests" value={events ? String(events.length) : "…"} />
          <StatCard
            label="Active users (this window)"
            value={events ? String(byOwner.size) : "…"}
          />
          <StatCard
            label="Projected credits"
            value={costs ? String(projectedCredits) : "…"}
            hint="requests × configured cost — not actually deducted anywhere yet"
          />
        </div>

        {events === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Cpu}
            title="No generation requests yet"
            description="Every time a teacher hits Create in a studio composer, it'll show up here."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By feature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.from(byFeature.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([feature, count]) => (
                    <div key={feature} className="flex items-center justify-between text-sm">
                      <span>{FEATURE_LABEL[feature] ?? feature}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Most active accounts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topOwners.map(([ownerId, count]) => (
                  <div key={ownerId} className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      {accountById.get(ownerId)?.name ?? accountById.get(ownerId)?.email ?? ownerId}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
