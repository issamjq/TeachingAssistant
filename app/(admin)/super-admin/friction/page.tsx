import { AlertTriangle } from "lucide-react";

import { NotWiredUpYet } from "@/features/admin/not-wired-up";

export default function SuperAdminFrictionPage() {
  return (
    <NotWiredUpYet
      icon={AlertTriangle}
      title="Friction"
      description="Errors, rage-clicks, abandons, and named stuck users."
      whatItNeeds="Depends on the same event tracking as Product analytics, plus an error-logging pipeline. Neither is wired up yet."
    />
  );
}
