"use client";

/**
 * components/onboarding/OnboardingPanel.tsx
 *
 * Thin composition root: delegates data + side-effects to `useOnboardingPanelData`,
 * layout + render to `OnboardingLayout`.
 */

import { useOnboardingPanelData } from "@/hooks/useOnboardingPanelData";
import OnboardingLayout from "./OnboardingLayout";

export default function OnboardingPanel() {
  const data = useOnboardingPanelData();
  return <OnboardingLayout {...data} />;
}
