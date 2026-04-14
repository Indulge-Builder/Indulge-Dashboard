"use client";

/**
 * hooks/usePrefersReducedMotion.ts
 *
 * Detects the user's `prefers-reduced-motion` media-query preference.
 * Previously copy-pasted identically inside both ActiveOutlays.tsx and
 * OnboardingPanel.tsx. Extracted here as the single canonical copy.
 *
 * Returns `true` when the user has requested reduced motion.
 *
 * Used to:
 *   - Skip CSS marquee animations (onboarding-ledger-track, outlays ledger)
 *   - Skip Framer Motion surge / shimmer effects in AgentLeaderboard
 */

import { useEffect, useState } from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
