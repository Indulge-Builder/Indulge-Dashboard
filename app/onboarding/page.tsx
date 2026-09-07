import DashboardRoot from "@/components/DashboardRoot";
import GatedPage from "@/components/GatedPage";

/** The live dashboard opened on the Onboarding (revenue) screen. */
export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <GatedPage>
      <DashboardRoot initialScreen="onboarding" />
    </GatedPage>
  );
}
