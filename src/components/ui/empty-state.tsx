import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        {Icon ? (
          <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Icon className="size-6" strokeWidth={1.5} />
          </span>
        ) : null}
        <div className="space-y-1">
          <p className="text-sm font-medium">{title}</p>
          {description ? (
            <p className="max-w-sm text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
