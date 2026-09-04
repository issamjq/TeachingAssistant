import { SiteHeader } from "@/components/layout/site-header";
import { OrganisationOnboardingForm } from "@/features/onboarding/organisation-onboarding-form";

export default function OrganisationOnboardingPage() {
  return (
    <div>
      <SiteHeader homeHref="/" label="Organisation application" />
      <div className="mx-auto max-w-lg p-6 md:p-10">
        <OrganisationOnboardingForm />
      </div>
    </div>
  );
}
