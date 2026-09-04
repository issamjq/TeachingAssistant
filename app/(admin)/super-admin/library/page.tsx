import { PageHeader } from "@/components/layout/page-header";
import { SharedLibraryManager } from "@/features/admin/shared-library-manager";

export default function SuperAdminLibraryPage() {
  return (
    <div>
      <PageHeader
        title="Shared library"
        description="Curriculum documents any teacher can attach from a class's Notes & text tab."
      />
      <div className="p-6 md:p-8">
        <SharedLibraryManager />
      </div>
    </div>
  );
}
