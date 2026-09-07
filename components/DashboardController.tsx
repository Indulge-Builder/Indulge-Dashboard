"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ConciergeScreen from "./concierge/ConciergeScreen";
import OnboardingLayout from "./onboarding/OnboardingLayout";
import HomePanel from "./HomePanel";
import ConciergeSkeleton from "./skeletons/ConciergeSkeleton";
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
import type { ActiveScreen, QueendomView } from "@/types";

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

/** The two-segment pill's shared button styling (TV-remote sized). */
const CONTROL_BUTTON_CLASS =
  "flex min-h-[64px] items-center justify-center font-montserrat text-2xl font-bold tracking-[0.05em] transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-400/80";

interface DashboardControllerProps {
  className?: string;
  /** One entry per queendom in TV order — the concierge screen's columns. */
  queendoms: QueendomView[];
  celebrationAgent: string | null;
  /**
   * When true, a skeleton overlay is rendered on top of each screen.
   * Fades out (AnimatePresence exit) once the first fetchAll() resolves.
   * The real screens are always mounted behind the overlay so their counters
   * animate from 0 quietly — no jarring re-render when the skeleton lifts.
   */
  isInitialLoading: boolean;
  /** Screen chosen on the landing page (/concierge or /onboarding). */
  initialScreen?: ActiveScreen;
}

export default function DashboardController({
  className,
  queendoms,
  celebrationAgent,
  isInitialLoading,
  initialScreen = "concierge",
}: DashboardControllerProps) {
  const router = useRouter();
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>(initialScreen);
  // Auto-switch paused for now — starts frozen on the chosen screen.
  // The top-right button switches panels manually; rotation only
  // re-enables via the P/Space keys.
  const [isFrozen, setIsFrozen] = useState(true);

  useEffect(() => {
    if (isFrozen) return;
    const timeoutId = window.setTimeout(() => {
      setActiveScreen((s) => nextActiveScreen(s));
    }, SCREEN_DURATIONS_MS[activeScreen]);
    return () => window.clearTimeout(timeoutId);
  }, [activeScreen, isFrozen]);

  // Escape / Backspace on the TV remote returns to the landing page.
  useKeyboardControls(setActiveScreen, setIsFrozen, () => router.push("/"));

  const destination: ActiveScreen = activeScreen === "concierge" ? "onboarding" : "concierge";

  return (
    <div
      className={`relative h-full w-full min-h-0 min-w-0 overflow-hidden ${className ?? ""}`}
    >
      {/* Always clickable: TV remotes often fail to deliver Enter to window; use pointer + arrow keys + OK.
          Two segments: MENU returns to the landing page; the other switches between the two
          screens — its label shows the DESTINATION screen. Auto-rotation stays frozen. */}
      <div
        className="absolute right-3 top-3 z-[100] flex overflow-hidden rounded-full border border-gold-500/40 bg-black/50 shadow-lg"
        role="group"
        aria-label="Dashboard controls"
      >
        <button
          type="button"
          aria-label="Back to the dashboard menu"
          className={`${CONTROL_BUTTON_CLASS} min-w-[120px] border-r border-gold-500/25 px-5 py-3.5 text-gold-400/80 hover:bg-black/65 hover:text-gold-200`}
          onClick={() => router.push("/")}
        >
          MENU
        </button>
        <button
          type="button"
          aria-label={`Switch to ${destination} screen`}
          className={`${CONTROL_BUTTON_CLASS} min-w-[188px] px-5 py-3.5 text-gold-200 hover:bg-black/65`}
          onClick={() => setActiveScreen(destination)}
        >
          {destination === "onboarding" ? "ONBOARDING" : "CONCIERGE"}
        </button>
      </div>

      {/* Screens stay mounted; only opacity/z-index changes (cinematic crossfade, no translateX tearing). */}
      <ScreenLayer isActive={activeScreen === "concierge"}>
        <div className="relative flex min-h-0 h-full w-full min-w-0 flex-col">
          <ErrorBoundary label="Concierge" fillParent>
            <ConciergeScreen queendoms={queendoms} celebrationAgent={celebrationAgent} />
          </ErrorBoundary>
          {/* Skeleton overlay — sits above the real screen until data is ready */}
          <SkeletonOverlay show={isInitialLoading}>
            <ConciergeSkeleton />
          </SkeletonOverlay>
        </div>
      </ScreenLayer>

      <ScreenLayer isActive={activeScreen === "onboarding"}>
        {/* Onboarding screen — isolated from the concierge screen */}
        <div className="relative flex min-h-0 h-full w-full min-w-0 flex-col">
          <ErrorBoundary label="Onboarding" fillParent>
            <OnboardingLayout />
          </ErrorBoundary>
          {/* Skeleton overlay — staggered 0.3s so the concierge → onboarding cascade feels intentional */}
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
