import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ROSTER } from "@/features/classes/mock-data";

const ASSESSMENTS = ["Unit 3 test", "Trade routes quiz", "Mid-term"];

function scoreFor(studentId: string, assessment: string) {
  let h = 0;
  for (const c of studentId + assessment) h = (h * 31 + c.charCodeAt(0)) % 100;
  return 55 + (h % 46);
}

export default function ClassResultsPage() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          {ASSESSMENTS.map((a) => (
            <TableHead key={a}>{a}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROSTER.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.name}</TableCell>
            {ASSESSMENTS.map((a) => (
              <TableCell key={a}>{scoreFor(s.id, a)}%</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
