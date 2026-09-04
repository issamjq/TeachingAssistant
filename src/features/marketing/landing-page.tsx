import { MarketingNav } from "./components/marketing-nav";
import { Hero } from "./components/hero";
import { ScopeStrip } from "./components/scope-strip";
import { FeaturesGrid } from "./components/features-grid";
import { HowItWorks } from "./components/how-it-works";
import { RolesSection } from "./components/roles-section";
import { PricingSection } from "./components/pricing-section";
import { FaqSection } from "./components/faq-section";
import { ClosingCta } from "./components/closing-cta";
import { MarketingFooter } from "./components/marketing-footer";

export function LandingPage() {
  return (
    <div className="theme-marketing min-h-svh bg-background text-foreground">
      <MarketingNav />
      <main>
        <Hero />
        <ScopeStrip />
        <FeaturesGrid />
        <HowItWorks />
        <RolesSection />
        <PricingSection />
        <FaqSection />
        <ClosingCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
