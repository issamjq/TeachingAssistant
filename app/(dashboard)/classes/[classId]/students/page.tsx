"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { listClassStudents, type StudentRow } from "@/lib/data/classes";
import { InviteStudentButton } from "@/features/classes/invite-student-button";

export default function ClassStudentsPage() {
  const { classId } = useParams<{ classId: string }>();
  const [students, setStudents] = useState<StudentRow[] | null>(null);

  const refresh = useCallback(() => {
    listClassStudents(classId).then(setStudents);
  }, [classId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Invite-only — a student needs an invite to get a login.
        </p>
        <InviteStudentButton classId={classId} onInvited={refresh} />
      </div>
      {students === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : students.length === 0 ? (
        <EmptyState
          title="No students yet"
          description="Invite a student above once your account is approved."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll no.</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground">{s.roll_no ?? "—"}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  <StatusPill status={s.status === "removed" ? "rejected" : s.status === "active" ? "active" : "pending"} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
