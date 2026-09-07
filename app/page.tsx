import DashboardPicker from "@/components/landing/DashboardPicker";
import GatedPage from "@/components/GatedPage";

/**
 * Entry point — the landing page that asks which dashboard to view
 * (Concierge → /concierge, Onboarding → /onboarding). Gate check per
 * request (components/GatedPage.tsx), so this route must not be statically
 * cached.
 */
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <GatedPage>
      <DashboardPicker />
    </GatedPage>
  );
}
