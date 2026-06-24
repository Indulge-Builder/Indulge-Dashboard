"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QueendomPanel from "./QueendomPanel";
import OnboardingLayout from "./onboarding/OnboardingLayout";
import HomePanel from "./HomePanel";
import QueendomSkeleton from "./skeletons/QueendomSkeleton";
import OnboardingSkeleton from "./skeletons/OnboardingSkeleton";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";
import { ScreenActivityContext } from "@/hooks/useScreenActive";
import { crossfadeTransition } from "@/lib/motionPresets";
import {
  HOME_PANEL_ENABLED,
  SCREEN_DURATIONS_MS,
  nextActiveScreen,
} from "@/lib/dashboardScreens";
import type { QueenStats } from "@/lib/types";
import type { ActiveScreen, RenewalsPanelData } from "@/types";

export type { ActiveScreen };

/**
 * Crossfade animation targets for a screen layer.
 *
 * Screens stay always-mounted (critical invariant — never unmount to
 * "optimize"), but a fully faded-out screen must not stay on the GPU paint
 * path: its rAF ledger, SVG filter pulses, and shimmer keyframes would keep
 * compositing invisibly 24/7 on TV hardware. `visibility` does exactly that —
 * hidden is applied only AFTER the fade completes (transitionEnd), and
 * visible is restored instantly when the fade-in starts, so the 1.5s
 * cinematic crossfade is visually unchanged.
 */
function screenFadeAnimate(isActive: boolean) {
  return isActive
    ? { opacity: 1, zIndex: 10, visibility: "visible" as const }
    : {
        opacity: 0,
        zIndex: 0,
        transitionEnd: { visibility: "hidden" as const },
      };
}

/**
 * One rotating screen layer (dry-audit A7). The rotation semantics — always
 * mounted, crossfade via opacity/zIndex/visibility only — live HERE and only
 * here. Never unmount a layer to "optimize".
 */
function ScreenLayer({
  isActive,
  children,
}: {
  isActive: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: isActive ? "auto" : "none" }}
      initial={false}
      animate={screenFadeAnimate(isActive)}
      transition={crossfadeTransition}
    >
      {/* Children read this via useScreenActive() to pause their own clocks
          (rAF / intervals) while hidden — layers themselves never unmount. */}
      <ScreenActivityContext.Provider value={isActive}>
        {children}
      </ScreenActivityContext.Provider>
    </motion.div>
  );
}

// Shared exit transition for skeleton overlays — matches the cinematic 1.5s
// Corporate fade — skeleton dissolves smoothly without fighting the content entrance.
const skeletonExitTransition = { duration: 0.7, ease: [0.4, 0, 0.2, 1] as const };

/** Skeleton overlay scaffold — fades out via AnimatePresence once data is ready. */
function SkeletonOverlay({
  show,
  delay = 0,
  children,
}: {
  show: boolean;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 z-20"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={delay ? { ...skeletonExitTransition, delay } : skeletonExitTransition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface DashboardControllerProps {
  className?: string;
  ananyshreeStats: QueenStats;
  anishqaStats: QueenStats;
  renewalsAnanyshree: RenewalsPanelData;
  renewalsAnishqa: RenewalsPanelData;
  celebrationAgent: string | null;
  /**
   * When true, a skeleton overlay is rendered on top of each panel.
   * Fades out (AnimatePresence exit) once the first fetchAll() resolves.
   * The real panels are always mounted behind the overlay so their counters
   * animate from 0 quietly — no jarring re-render when the skeleton lifts.
   */
  isInitialLoading: boolean;
}

export default function DashboardController({
  className,
  ananyshreeStats,
  anishqaStats,
  renewalsAnanyshree,
  renewalsAnishqa,
  celebrationAgent,
  isInitialLoading,
}: DashboardControllerProps) {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("concierge");
  const [isFrozen, setIsFrozen] = useState(false);

  useEffect(() => {
    if (isFrozen) return;
    const timeoutId = window.setTimeout(() => {
      setActiveScreen((s) => nextActiveScreen(s));
    }, SCREEN_DURATIONS_MS[activeScreen]);
    return () => window.clearTimeout(timeoutId);
  }, [activeScreen, isFrozen]);

  useKeyboardControls(setActiveScreen, setIsFrozen);

  return (
    <div
      className={`relative h-full w-full min-h-0 min-w-0 overflow-hidden ${className ?? ""}`}
    >
      {/* Always clickable: TV remotes often fail to deliver Enter to window; use pointer + P key + OK */}
      <button
        type="button"
        aria-pressed={isFrozen}
        aria-label={isFrozen ? "Resume auto-switching" : "Pause on this screen"}
        className={`absolute right-3 top-3 z-[100] min-h-[48px] min-w-[140px] rounded-full border px-5 py-2.5 font-montserrat text-base font-semibold tracking-[0.2em] shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/80 ${
          isFrozen
            ? "border-emerald-500/50 bg-emerald-950/75 text-emerald-200"
            : "border-gold-500/40 bg-black/50 text-gold-200 hover:bg-black/65"
        }`}
        onClick={() => setIsFrozen((v) => !v)}
      >
        {isFrozen ? "RESUME" : "PAUSE"}
      </button>

      {/* Screens stay mounted; only opacity/z-index changes (cinematic crossfade, no translateX tearing). */}
      <ScreenLayer isActive={activeScreen === "concierge"}>
        <div className="flex min-h-0 h-full w-full min-w-0 flex-col gap-8 md:flex-row md:items-stretch">
          {/* Ananyshree panel — isolated so its crash cannot affect Anishqa */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col md:basis-0">
            <ErrorBoundary label="Ananyshree" fillParent>
              <QueendomPanel
                name="Ananyshree"
                stats={ananyshreeStats}
                side="left"
                delay={0}
                celebrationAgent={celebrationAgent}
                renewalsData={renewalsAnanyshree}
              />
            </ErrorBoundary>
            {/* Skeleton overlay — sits above the real panel until data is ready */}
            <SkeletonOverlay show={isInitialLoading}>
              <QueendomSkeleton side="left" />
            </SkeletonOverlay>
          </div>

          {/* Center column — full-height gold separator between Queendoms (md+) */}
          <div
            className="relative hidden shrink-0 self-stretch md:block"
            style={{ width: "var(--size-center-separator)" }}
            aria-hidden
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 160% 50% at 50% 50%, rgba(201,168,76,0.032), transparent)",
              }}
            />
            <div className="absolute left-1/2 top-[2vh] bottom-[2vh] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-gold-500/35 to-transparent" />
            <div
              className="pointer-events-none absolute left-1/2 top-[2vh] bottom-[2vh] w-[4px] -translate-x-1/2"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 8%, rgba(201,168,76,0.08) 30%, rgba(201,168,76,0.12) 50%, rgba(201,168,76,0.08) 70%, transparent 92%)",
                filter: "blur(2px)",
              }}
            />
          </div>

          <div className="h-px w-full shrink-0 bg-gradient-to-r from-transparent via-gold-500/25 to-transparent md:hidden" />

          {/* Anishqa panel — isolated so its crash cannot affect Ananyshree */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col md:basis-0">
            <ErrorBoundary label="Anishqa" fillParent>
              <QueendomPanel
                name="Anishqa"
                stats={anishqaStats}
                side="right"
                delay={150}
                celebrationAgent={celebrationAgent}
                renewalsData={renewalsAnishqa}
              />
            </ErrorBoundary>
            {/* Skeleton overlay — staggered 0.15s after left panel for a cascade reveal */}
            <SkeletonOverlay show={isInitialLoading} delay={0.15}>
              <QueendomSkeleton side="right" />
            </SkeletonOverlay>
          </div>
        </div>
      </ScreenLayer>

      <ScreenLayer isActive={activeScreen === "onboarding"}>
        {/* Onboarding screen — isolated from the concierge screens */}
        <div className="relative flex min-h-0 h-full w-full min-w-0 flex-col">
          <ErrorBoundary label="Onboarding" fillParent>
            <OnboardingLayout />
          </ErrorBoundary>
          {/* Skeleton overlay — staggered 0.3s so the left→right→onboarding cascade feels intentional */}
          <SkeletonOverlay show={isInitialLoading} delay={0.3}>
            <OnboardingSkeleton />
          </SkeletonOverlay>
        </div>
      </ScreenLayer>

      {HOME_PANEL_ENABLED && (
        <ScreenLayer isActive={activeScreen === "home"}>
          <div className="relative flex min-h-0 h-full w-full min-w-0 flex-col">
            <ErrorBoundary label="Home" fillParent>
              <HomePanel />
            </ErrorBoundary>
          </div>
        </ScreenLayer>
      )}
    </div>
  );
}
