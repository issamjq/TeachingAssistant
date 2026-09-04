import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ROSTER } from "@/features/classes/mock-data";
import { InviteStudentButton } from "@/features/classes/invite-student-button";

export default function ClassStudentsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Invite-only — a student needs an invite to get a login.
        </p>
        <InviteStudentButton />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Roll no.</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROSTER.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-muted-foreground">{s.rollNo}</TableCell>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>
                <StatusPill status="active" />
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
