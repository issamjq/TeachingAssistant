import { SiteHeader } from "@/components/layout/site-header";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";

const DEADLINES = [
  { id: "d1", title: "Trade routes quiz", subject: "Social Studies", due: "16 Oct", status: "scheduled" as const },
  { id: "d2", title: "Homework: map worksheet", subject: "Social Studies", due: "18 Oct", status: "scheduled" as const },
];

const CLASSES = [
  { id: "c3", subject: "Social Studies", teacher: "Rana Al Sayed" },
  { id: "c4", subject: "English", teacher: "Priya Nair" },
];

export default function StudentPortalPage() {
  return (
    <div>
      <SiteHeader homeHref="/student" label="Student" />
      <PageHeader
        title="Welcome back"
        description="Grade 10 · Division B"
      />
      <div className="grid gap-4 p-6 md:grid-cols-2 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Coming up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DEADLINES.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium leading-snug">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.subject} · Due {d.due}
                  </p>
                </div>
                <StatusPill status={d.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CLASSES.map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.subject}</p>
                  <p className="text-xs text-muted-foreground">{c.teacher}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
