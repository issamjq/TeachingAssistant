"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useSession } from "@/features/auth/session-context";
import {
  listAllAccounts,
  updateAccountRole,
  updateAccountStatus,
  type AccountRow,
  type AccountRole,
  type AccountStatus,
} from "@/lib/data/superadmin";

const ROLES: AccountRole[] = ["teacher", "sub_admin", "super_admin", "organisation"];
const ROLE_FILTERS = ["all", ...ROLES] as const;

export default function SuperAdminAccountsPage() {
  const { user } = useSession();
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listAllAccounts().then(setAccounts);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!accounts) return null;
    return roleFilter === "all" ? accounts : accounts.filter((a) => a.role === roleFilter);
  }, [accounts, roleFilter]);

  async function changeRole(id: string, role: AccountRole) {
    setBusyId(id);
    try {
      await updateAccountRole(id, role);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function changeStatus(id: string, status: AccountStatus) {
    setBusyId(id);
    try {
      await updateAccountStatus(id, status);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Every profile in Supabase — approve, reject, suspend, or change a role."
      />
      <div className="space-y-4 p-6 md:p-8">
        <div className="flex flex-wrap gap-1 rounded-lg bg-secondary p-1">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                roleFilter === r
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.replace("_", " ")}
            </button>
          ))}
        </div>

        {filtered === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No accounts match" description="Try a different role filter." />
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const isSelf = a.id === user?.id;
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <p className="font-medium">{a.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </TableCell>
                        <TableCell>
                          <select
                            value={a.role}
                            disabled={busyId === a.id || isSelf}
                            onChange={(e) => changeRole(a.id, e.target.value as AccountRole)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs capitalize shadow-sm disabled:opacity-50"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <StatusPill status={a.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {a.status !== "active" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busyId === a.id}
                                onClick={() => changeStatus(a.id, "active")}
                              >
                                Approve
                              </Button>
                            ) : null}
                            {a.status !== "rejected" && !isSelf ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={busyId === a.id}
                                onClick={() => changeStatus(a.id, "rejected")}
                              >
                                {a.status === "pending" ? "Reject" : "Suspend"}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
