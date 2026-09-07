import DashboardRoot from "@/components/DashboardRoot";
import GatedPage from "@/components/GatedPage";

/** The live dashboard opened on the Concierge screen (three Queendoms). */
export const dynamic = "force-dynamic";

export default function ConciergePage() {
  return (
    <GatedPage>
      <DashboardRoot initialScreen="concierge" />
    </GatedPage>
  );
}
