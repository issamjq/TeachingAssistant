import { SuperAdminShell } from "@/components/layout/super-admin-shell";
import { RoadmapPage } from "@/features/admin/roadmap";

export default function Roadmap() {
  return (
    <SuperAdminShell>
      <RoadmapPage />
    </SuperAdminShell>
  );
}
