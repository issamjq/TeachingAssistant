import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusPill } from "@/components/ui/status-pill";
import { ROSTER } from "@/features/classes/mock-data";

const STATUSES = ["present", "present", "late", "present", "absent", "present", "present", "present"] as const;

export default function ClassAttendancePage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Today, 12 Oct</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Roll no.</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROSTER.map((s, i) => (
            <TableRow key={s.id}>
              <TableCell className="text-muted-foreground">{s.rollNo}</TableCell>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>
                <StatusPill status={STATUSES[i % STATUSES.length]} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
