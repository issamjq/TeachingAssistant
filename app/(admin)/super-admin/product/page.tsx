"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { listPageViewEvents, type AnalyticsEventRow } from "@/lib/data/superadmin";

export default function SuperAdminProductPage() {
  const [events, setEvents] = useState<AnalyticsEventRow[] | null>(null);

  useEffect(() => {
    listPageViewEvents().then(setEvents);
  }, []);

  const byPath = new Map<string, number>();
  const owners = new Set<string>();
  for (const e of events ?? []) {
    if (e.path) byPath.set(e.path, (byPath.get(e.path) ?? 0) + 1);
    owners.add(e.owner_id);
  }
  const topPaths = Array.from(byPath.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <div>
      <PageHeader
        title="Product analytics"
        description="Real page-view counts from every signed-in screen — no click-heatmaps, funnels, or retention cohorts yet."
      />
      <div className="space-y-6 p-6 md:p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard label="Page views" value={events ? String(events.length) : "…"} />
          <StatCard label="Unique visitors" value={events ? String(owners.size) : "…"} />
          <StatCard label="Distinct pages" value={events ? String(byPath.size) : "…"} />
        </div>

        {events === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No page views recorded yet"
            description="Every screen inside the signed-in app logs a view here as people use it."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Most-visited pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topPaths.map(([path, count]) => (
                <div key={path} className="flex items-center justify-between text-sm">
                  <span className="truncate font-mono text-xs">{path}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
