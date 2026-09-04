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
  { id: "t1", name: "Rana Al Sayed", institution: "Greenwood International School", applied: "1 day ago" },
  { id: "t2", name: "Hassan Malik", institution: "Al Noor Academy", applied: "3 days ago" },
];

const APPROVED_TEACHERS = [
  { id: "t3", name: "Priya Nair", institution: "Greenwood International School", status: "active" as const },
  { id: "t4", name: "James Wong", institution: "Al Noor Academy", status: "active" as const },
];

export default function SubAdminPage() {
  return (
    <div>
      <SiteHeader homeHref="/sub-admin" label="Sub admin" />
      <PageHeader
        title="Sub admin"
        description="Approves teachers within your delegated scope."
      />
      <div className="space-y-6 p-6 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Pending teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {PENDING_TEACHERS.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.institution}</TableCell>
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

        <Card>
          <CardHeader>
            <CardTitle>Approved teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {APPROVED_TEACHERS.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.institution}</TableCell>
                    <TableCell><StatusPill status={t.status} /></TableCell>
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
