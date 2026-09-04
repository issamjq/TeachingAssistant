import { UserPlus } from "lucide-react";

import { SiteHeader } from "@/components/layout/site-header";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const PENDING_ORGS = [
  { id: "o1", name: "Greenwood International School", applied: "2 days ago" },
  { id: "o2", name: "Al Noor Academy", applied: "5 days ago" },
];

const SUB_ADMINS = [
  { id: "sa1", name: "Meera Krishnan", scope: "UAE — Northern region", status: "active" as const },
  { id: "sa2", name: "Daniel Cho", scope: "Independent schools", status: "active" as const },
];

export default function SuperAdminPage() {
  return (
    <div>
      <SiteHeader homeHref="/super-admin" label="Super admin" />
      <PageHeader
        title="Super admin"
        description="Grants access to sub-admins and organisations."
      />
      <div className="space-y-6 p-6 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Pending organisations</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {PENDING_ORGS.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell className="text-muted-foreground">{o.applied}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm">Review docs</Button>
                        <Button size="sm">Approve</Button>
                        <Button variant="destructive" size="sm">Reject</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Sub-admins</CardTitle>
            <Button size="sm" variant="outline">
              <UserPlus /> Invite sub-admin
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Delegated scope</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SUB_ADMINS.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.scope}</TableCell>
                    <TableCell><StatusPill status={s.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
