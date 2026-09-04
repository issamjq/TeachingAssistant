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

const PENDING_TEACHERS = [
  { id: "t1", name: "Rana Al Sayed", staffId: "GIS-2291", applied: "1 day ago" },
  { id: "t2", name: "Kavya Menon", staffId: "GIS-2318", applied: "4 hours ago" },
];

export default function OrganisationConsolePage() {
  return (
    <div>
      <SiteHeader homeHref="/organisation" label="Organisation" />
      <PageHeader
        title="Greenwood International School"
        description="Approves its own teachers and manages identity documents."
      />
      <div className="space-y-6 p-6 md:p-8">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Verification status</CardTitle>
            <StatusPill status="approved" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Identity documents verified by a super_admin. Your organisation
              can approve its own teachers.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {PENDING_TEACHERS.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.staffId}</TableCell>
                    <TableCell className="text-muted-foreground">{t.applied}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
      </div>
    </div>
  );
}
