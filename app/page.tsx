import { cookies } from "next/headers";
import DashboardRoot from "@/components/DashboardRoot";
import ViewerGate from "@/components/ViewerGate";
import {
  VIEWER_COOKIE,
  isValidViewerToken,
  isViewerGateEnabled,
} from "@/lib/viewerGate";

/**
 * Entry point. Server-side gate check (lib/viewerGate.ts — opt-in via
 * DASHBOARD_PIN, off when unset) → device-aware shell: DashboardRoot renders
 * the untouched TV canvas on large/fine-pointer screens and the mobile feed
 * on phones. Cookie check runs per-request, so this route must not be
 * statically cached.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  if (isViewerGateEnabled()) {
    const token = (await cookies()).get(VIEWER_COOKIE)?.value;
    if (!isValidViewerToken(token)) {
      return <ViewerGate />;
    }
  }
  return <DashboardRoot />;
}
