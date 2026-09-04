"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { listAllAccounts, type AccountRow } from "@/lib/data/superadmin";

export default function SuperAdminOrgsPage() {
  const [orgs, setOrgs] = useState<AccountRow[] | null>(null);

  useEffect(() => {
    listAllAccounts().then((rows) => setOrgs(rows.filter((r) => r.role === "organisation")));
  }, []);

  return (
    <div>
      <PageHeader
        title="Organisations"
        description="Accounts with the organisation role, pending or approved."
      />
      <div className="space-y-4 p-6 md:p-8">
        <p className="text-xs text-muted-foreground">
          Sign-up only ever creates a teacher account right now — there's no organisation
          sign-up flow wired to a real submission yet, so this list is genuinely empty until
          that ships.
        </p>
        {orgs === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : orgs.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No organisations yet"
            description="Once organisation sign-up is wired up, applications will land here for review."
          />
        ) : (
          <div className="space-y-2">
            {orgs.map((o) => (
              <Card key={o.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">{o.institution ?? o.name}</p>
                    <p className="text-xs text-muted-foreground">{o.email}</p>
                  </div>
                  <StatusPill status={o.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
