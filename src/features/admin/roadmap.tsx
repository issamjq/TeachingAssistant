import { CheckCircle2, Circle, CircleDot } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { ROADMAP, ROADMAP_UPDATED, type CheckpointStatus } from "@/features/admin/roadmap-data";

const STATUS_LABEL: Record<CheckpointStatus, string> = {
  done: "Done",
  "in-progress": "In progress",
  planned: "Planned",
};

const STATUS_BADGE_VARIANT: Record<CheckpointStatus, "success" | "warning" | "outline"> = {
  done: "success",
  "in-progress": "warning",
  planned: "outline",
};

const STATUS_ICON: Record<CheckpointStatus, typeof CheckCircle2> = {
  done: CheckCircle2,
  "in-progress": CircleDot,
  planned: Circle,
};

const STATUS_ICON_CLASS: Record<CheckpointStatus, string> = {
  done: "text-success",
  "in-progress": "text-warning",
  planned: "text-muted-foreground",
};

export function RoadmapPage() {
  const doneCount = ROADMAP.filter((c) => c.status === "done").length;
  const current = ROADMAP.find((c) => c.status === "in-progress");

  return (
    <div>
      <PageHeader
        title="Roadmap"
        description={`Where murchid is, and where it's going. Last updated ${ROADMAP_UPDATED}.`}
      />
      <div className="space-y-8 p-6 md:p-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard label="Checkpoints done" value={`${doneCount} / ${ROADMAP.length}`} />
          <StatCard
            label="Current focus"
            value={current?.title ?? "—"}
            hint={current?.period}
          />
          <StatCard
            label="Next deadline"
            value={current?.period.replace(/^Target:\s*/, "") ?? "—"}
            hint={current?.title}
          />
        </div>

        <ol className="relative space-y-8 border-l border-border pl-8">
          {ROADMAP.map((checkpoint) => {
            const Icon = STATUS_ICON[checkpoint.status];
            return (
              <li key={checkpoint.id} className="relative">
                <span
                  className={`absolute -left-[calc(2rem+1px)] flex size-6 items-center justify-center rounded-full bg-background ${STATUS_ICON_CLASS[checkpoint.status]}`}
                >
                  <Icon className="size-5" />
                </span>
                <Card>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">{checkpoint.title}</h3>
                        <p className="text-xs text-muted-foreground">{checkpoint.period}</p>
                      </div>
                      <Badge variant={STATUS_BADGE_VARIANT[checkpoint.status]}>
                        {STATUS_LABEL[checkpoint.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{checkpoint.summary}</p>
                    <ul className="space-y-1.5 pl-1">
                      {checkpoint.items.map((item) => (
                        <li key={item} className="flex gap-2 text-sm">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
