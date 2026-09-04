import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const CAPABILITIES = [
  { label: "Draft & prepare own classes", teacher: true, sub_admin: true, super_admin: true, organisation: false },
  { label: "Invite & manage own students", teacher: true, sub_admin: true, super_admin: true, organisation: false },
  { label: "Approve or reject any account", teacher: false, sub_admin: true, super_admin: true, organisation: false },
  { label: "Change any account's role", teacher: false, sub_admin: false, super_admin: true, organisation: false },
  { label: "Curate the shared library", teacher: false, sub_admin: true, super_admin: true, organisation: false },
  { label: "View every teacher's roster", teacher: false, sub_admin: true, super_admin: true, organisation: false },
  { label: "Approve its own organisation's teachers", teacher: false, sub_admin: false, super_admin: false, organisation: true },
] as const;

const ROLE_COLUMNS = ["teacher", "sub_admin", "super_admin", "organisation"] as const;

export default function SuperAdminRolesPage() {
  return (
    <div>
      <PageHeader
        title="Roles"
        description="What each role can do — enforced by Row Level Security, not just this table."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/super-admin/accounts">Edit a person's role</Link>
          </Button>
        }
      />
      <div className="p-6 md:p-8">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Capability</TableHead>
                  {ROLE_COLUMNS.map((r) => (
                    <TableHead key={r} className="text-center capitalize">
                      {r.replace("_", " ")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {CAPABILITIES.map((cap) => (
                  <TableRow key={cap.label}>
                    <TableCell className="font-medium">{cap.label}</TableCell>
                    {ROLE_COLUMNS.map((r) => (
                      <TableCell key={r} className="text-center">
                        {cap[r] ? (
                          <Check className="mx-auto size-4 text-success" />
                        ) : (
                          <Minus className="mx-auto size-4 text-muted-foreground/40" />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="mt-4 text-xs text-muted-foreground">
          There's no separate per-person permission-override system yet — every account's
          capabilities come from its role alone.
        </p>
      </div>
    </div>
  );
}
