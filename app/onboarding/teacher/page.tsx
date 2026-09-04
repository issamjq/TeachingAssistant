import { SiteHeader } from "@/components/layout/site-header";
import { TeacherOnboardingForm } from "@/features/onboarding/teacher-onboarding-form";

export default function TeacherOnboardingPage() {
  return (
    <div>
      <SiteHeader homeHref="/" label="Teacher onboarding" />
      <div className="mx-auto max-w-lg p-6 md:p-10">
        <TeacherOnboardingForm />
      </div>
    </div>
  );
}
