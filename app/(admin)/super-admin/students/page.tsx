"use client";

import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { listAllStudentsAdmin, type StudentAdminRow } from "@/lib/data/superadmin";

export default function SuperAdminStudentsPage() {
  const [rows, setRows] = useState<StudentAdminRow[] | null>(null);

  useEffect(() => {
    listAllStudentsAdmin().then(setRows);
  }, []);

  return (
    <div>
      <PageHeader
        title="Students"
        description="Every student across every teacher's roster, read-only."
      />
      <div className="p-6 md:p-8">
        {rows === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No students yet"
            description="Students show up here once a teacher invites their first one."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll no.</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.roll_no ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.email ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={s.status === "active" ? "success" : "outline"}
                          className="capitalize"
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
