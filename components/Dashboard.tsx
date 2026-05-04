"use client";

/**
 * components/Dashboard.tsx — Layout shell.
 *
 * Responsibilities (only these, nothing else):
 *   - Compose useDashboardData + useCelebrationDetection hooks
 *   - Render the three layout regions: TopBar / main content / Ticker
 *   - Pass data down to children via props (no child fetches anything)
 *
 * All data fetching, Supabase Realtime subscriptions, IST-prune intervals,
 * and celebration detection live in their respective hooks. This file is
 * intentionally kept as a thin render shell.
 */

import { useDashboardData } from "@/hooks/useDashboardData";
import { useCelebrationDetection } from "@/hooks/useCelebrationDetection";
import TopBar from "./TopBar";
import DashboardController from "./DashboardController";
import CelebrationOverlay from "./CelebrationOverlay";
import RecommendationTicker from "./RecommendationTicker";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function Dashboard() {
  // ── Data + realtime state ──────────────────────────────────────────────────
  const {
    ananyshreeStats,
    anishqaStats,
    recommendations,
    renewalsAnanyshree,
    renewalsAnishqa,
    isInitialLoading,
  } = useDashboardData();

  // ── Celebration detection ──────────────────────────────────────────────────
  const { celebrationAgent, clearCelebration } = useCelebrationDetection(
    ananyshreeStats.agents,
    anishqaStats.agents,
  );

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col w-full min-h-screen md:w-screen md:h-screen bg-obsidian overflow-auto md:overflow-hidden">
      {/* Full-screen ambient glow — decorative, pointer-events-none */}
      <div className="absolute inset-0 ambient-glow-center" />

      {/* TopBar — isolated so a clock/date crash never blanks the screen */}
      <ErrorBoundary label="Top Bar">
        <TopBar />
      </ErrorBoundary>

      {/* Celebration overlay — isolated so an animation crash can't block panels */}
      <ErrorBoundary label="Celebration">
        <CelebrationOverlay
          agentName={celebrationAgent}
          onComplete={clearCelebration}
        />
      </ErrorBoundary>

      {/* Main content: Concierge ↔ Onboarding auto-rotating panel */}
      <DashboardController
        className="min-h-0 min-w-0 flex-1"
        ananyshreeStats={ananyshreeStats}
        anishqaStats={anishqaStats}
        renewalsAnanyshree={renewalsAnanyshree}
        renewalsAnishqa={renewalsAnishqa}
        celebrationAgent={celebrationAgent}
        isInitialLoading={isInitialLoading}
      />

      {/* Ticker — isolated so a marquee/Framer crash never pulls down the panels */}
      <div className="relative z-10 w-full shrink-0">
        <ErrorBoundary label="Recommendation Ticker">
          <RecommendationTicker recommendations={recommendations} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
