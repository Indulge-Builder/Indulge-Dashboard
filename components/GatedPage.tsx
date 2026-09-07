import { cookies } from "next/headers";
import ViewerGate from "@/components/ViewerGate";
import {
  VIEWER_COOKIE,
  isValidViewerToken,
  isViewerGateEnabled,
} from "@/lib/viewerGate";

/**
 * Server-side viewer gate shared by every dashboard route (/, /concierge,
 * /onboarding). lib/viewerGate.ts is opt-in via DASHBOARD_PIN — unset means
 * the children render for everyone. Pages using this must be
 * `dynamic = "force-dynamic"` because the cookie check runs per request.
 */
export default async function GatedPage({ children }: { children: React.ReactNode }) {
  if (isViewerGateEnabled()) {
    const token = (await cookies()).get(VIEWER_COOKIE)?.value;
    if (!isValidViewerToken(token)) return <ViewerGate />;
  }
  return <>{children}</>;
}
