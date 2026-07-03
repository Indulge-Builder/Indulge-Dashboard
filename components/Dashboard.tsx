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
import { useDaypartTheme } from "@/hooks/useDaypartTheme";
import TopBar from "./TopBar";
import DashboardController from "./DashboardController";
import CelebrationOverlay from "./CelebrationOverlay";
import OverdueTicker from "./OverdueTicker";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export default function Dashboard() {
  // ── Daypart theme: data-neu="light|dark" on <html>, re-checked every 60s ──
  useDaypartTheme();

  // ── Data + realtime state ──────────────────────────────────────────────────
  const {
    ananyshreeStats,
    anishqaStats,
    overdueTickets,
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
    <div className="relative flex flex-col w-full min-h-screen md:w-screen md:h-screen bg-neu-canvas overflow-auto md:overflow-hidden">
      {/* Drifting pastel blobs — the only full-canvas ambient layer */}
      <div className="neu-blobs" aria-hidden>
        <div className="neu-blob neu-blob-a" />
        <div className="neu-blob neu-blob-b" />
        <div className="neu-blob neu-blob-c" />
      </div>

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
        <ErrorBoundary label="Overdue Ticker">
          <OverdueTicker overdueTickets={overdueTickets} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
