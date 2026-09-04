import { BarChart3 } from "lucide-react";

import { NotWiredUpYet } from "@/features/admin/not-wired-up";

export default function SuperAdminProductPage() {
  return (
    <NotWiredUpYet
      icon={BarChart3}
      title="Product analytics"
      description="Screen usage, feature adoption, activation and retention."
      whatItNeeds="Needs client-side event tracking wired into the app first (page views, clicks, feature usage) and somewhere to store it. No telemetry is collected yet."
    />
  );
}
