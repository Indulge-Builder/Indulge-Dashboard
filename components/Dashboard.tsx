"use client";

/**
 * components/Dashboard.tsx — Layout shell (TV tree).
 *
 * Responsibilities (only these, nothing else):
 *   - Compose useDashboardData + useCelebrationDetection hooks
 *   - Shape the per-queendom record into the ordered QueendomView list
 *   - Render the three layout regions: TopBar / main content / Ticker
 *   - Pass data down to children via props (no child fetches anything)
 *
 * All data fetching, Supabase Realtime subscriptions, IST-prune intervals,
 * and celebration detection live in their respective hooks. This file is
 * intentionally kept as a thin render shell.
 */

import { useMemo } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCelebrationDetection } from "@/hooks/useCelebrationDetection";
import { QUEENDOM_DISPLAY_NAME, QUEENDOM_IDS } from "@/lib/queendom";
import TopBar from "./TopBar";
import DashboardController from "./DashboardController";
import CelebrationOverlay from "./CelebrationOverlay";
import OverdueTicker from "./OverdueTicker";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type { ActiveScreen, QueendomView } from "@/types";

export default function Dashboard({ initialScreen }: { initialScreen?: ActiveScreen }) {
  // ── Data + realtime state ──────────────────────────────────────────────────
  const { queendoms, renewals, overdueTickets, isInitialLoading } = useDashboardData();

  // ── Ordered views for the concierge columns ────────────────────────────────
  const views = useMemo<QueendomView[]>(
    () =>
      QUEENDOM_IDS.map((id) => ({
        id,
        name: QUEENDOM_DISPLAY_NAME[id],
        stats: queendoms[id],
        renewals: renewals[id],
      })),
    [queendoms, renewals],
  );

  // ── Celebration detection — over every queendom's agents ───────────────────
  const allAgents = useMemo(
    () => QUEENDOM_IDS.flatMap((id) => queendoms[id].agents),
    [queendoms],
  );
  const { celebrationAgent, clearCelebration } = useCelebrationDetection(allAgents);

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

      {/* Main content: Concierge ↔ Onboarding screens */}
      <DashboardController
        className="min-h-0 min-w-0 flex-1"
        queendoms={views}
        celebrationAgent={celebrationAgent}
        isInitialLoading={isInitialLoading}
        initialScreen={initialScreen}
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
