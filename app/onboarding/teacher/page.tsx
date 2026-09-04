import { OnboardingShell } from "@/features/onboarding/onboarding-shell";
import { TeacherOnboardingForm } from "@/features/onboarding/teacher-onboarding-form";

export default function TeacherOnboardingPage() {
  return (
    <OnboardingShell label="Teacher application">
      <TeacherOnboardingForm />
    </OnboardingShell>
  );
}
