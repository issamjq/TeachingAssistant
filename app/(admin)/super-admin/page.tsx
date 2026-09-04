"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  getPlatformStats,
  listAllAccounts,
  type PlatformStats,
  type AccountRow,
} from "@/lib/data/superadmin";

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recent, setRecent] = useState<AccountRow[] | null>(null);

  const refresh = useCallback(() => {
    getPlatformStats().then(setStats);
    listAllAccounts().then((rows) => setRecent(rows.slice(0, 6)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pending = recent?.filter((a) => a.status === "pending") ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live counts from Supabase — no fabricated numbers."
      />
      <div className="space-y-6 p-6 md:p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Accounts" value={stats ? String(stats.totalAccounts) : "…"} />
          <StatCard
            label="Pending approval"
            value={stats ? String(stats.pendingAccounts) : "…"}
          />
          <StatCard label="Active" value={stats ? String(stats.activeAccounts) : "…"} />
          <StatCard label="Classes" value={stats ? String(stats.totalClasses) : "…"} />
          <StatCard label="Students" value={stats ? String(stats.totalStudents) : "…"} />
          <StatCard
            label="Shared materials"
            value={stats ? String(stats.sharedMaterials) : "…"}
          />
        </div>

        {pending.length > 0 ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Waiting on approval</CardTitle>
              <Button asChild size="sm" variant="outline">
                <Link href="/super-admin/accounts">Review in Accounts</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {pending.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.name ?? a.email}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.email} · {a.role}
                    </p>
                  </div>
                  <StatusPill status="pending" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Newest accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts yet.</p>
            ) : (
              recent.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.name ?? a.email}</p>
                    <p className="truncate text-xs text-muted-foreground capitalize">
                      {a.role.replace("_", " ")}
                    </p>
                  </div>
                  <StatusPill status={a.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
