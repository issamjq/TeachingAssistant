import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { BarChart } from "@/components/charts/bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";

const ATTENDANCE_WEEK = [
  { label: "Mon", value: 96 },
  { label: "Tue", value: 92 },
  { label: "Wed", value: 88 },
  { label: "Thu", value: 94 },
  { label: "Fri", value: 90 },
];

const UPCOMING = [
  { id: "u1", title: "Unit 3 test — Grade 10B Social", date: "14 Oct", status: "scheduled" as const },
  { id: "u2", title: "Trade routes quiz — Grade 10B Social", date: "16 Oct", status: "scheduled" as const },
  { id: "u3", title: "Mid-term exam — Grade 10B Social", date: "28 Oct", status: "draft" as const },
];

export default function OverviewPage() {
  return (
    <div>
      <PageHeader
        title="Overview"
        description="Where your classes stand this week."
      />
      <div className="space-y-6 p-6 md:p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Classes" value="6" hint="across 2 batches" />
          <StatCard label="Students" value="138" hint="+4 this term" trend="up" />
          <StatCard label="Avg. attendance" value="92%" hint="+2% vs last week" trend="up" />
          <StatCard label="Pending review" value="3" hint="AI drafts awaiting approval" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Attendance this week</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart data={ATTENDANCE_WEEK} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coming up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {UPCOMING.map((u) => (
                <div key={u.id} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium leading-snug">{u.title}</p>
                    <p className="text-xs text-muted-foreground">{u.date}</p>
                  </div>
                  <StatusPill status={u.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
