import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export function NotWiredUpYet({
  title,
  description,
  icon,
  whatItNeeds,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  whatItNeeds: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="p-6 md:p-8">
        <EmptyState icon={icon} title="Not wired up yet" description={whatItNeeds} />
      </div>
    </div>
  );
}
