import { OnboardingShell } from "@/features/onboarding/onboarding-shell";
import { OrganisationOnboardingForm } from "@/features/onboarding/organisation-onboarding-form";

export default function OrganisationOnboardingPage() {
  return (
    <OnboardingShell label="Organisation application">
      <OrganisationOnboardingForm />
    </OnboardingShell>
  );
}
