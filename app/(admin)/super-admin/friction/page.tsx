"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listAllAccounts,
  listClientErrorEvents,
  type AccountRow,
  type AnalyticsEventRow,
} from "@/lib/data/superadmin";

export default function SuperAdminFrictionPage() {
  const [events, setEvents] = useState<AnalyticsEventRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);

  useEffect(() => {
    listClientErrorEvents().then(setEvents);
    listAllAccounts().then(setAccounts);
  }, []);

  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const affected = new Set((events ?? []).map((e) => e.owner_id));

  return (
    <div>
      <PageHeader
        title="Friction"
        description="Real unhandled client errors — rage-clicks, dead-clicks, and abandons aren't tracked yet."
      />
      <div className="space-y-6 p-6 md:p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard label="Errors logged" value={events ? String(events.length) : "…"} />
          <StatCard label="Accounts affected" value={events ? String(affected.size) : "…"} />
        </div>

        {events === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No client errors logged"
            description="Uncaught errors and rejected promises from the signed-in app will show up here."
          />
        ) : (
          <Card>
            <CardContent className="space-y-2 p-4">
              {events.map((e) => (
                <div key={e.id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {accountById.get(e.owner_id)?.name ??
                        accountById.get(e.owner_id)?.email ??
                        e.owner_id}
                    </p>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{e.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
