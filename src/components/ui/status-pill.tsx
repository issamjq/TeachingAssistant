import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT = {
  pending: "warning",
  active: "success",
  approved: "success",
  rejected: "destructive",
  present: "success",
  absent: "destructive",
  late: "warning",
  pass: "success",
  fail: "destructive",
  draft: "secondary",
  scheduled: "outline",
} as const;

export type StatusKind = keyof typeof STATUS_VARIANT;

export function StatusPill({ status }: { status: StatusKind }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className="capitalize">
      {status}
    </Badge>
  );
}
