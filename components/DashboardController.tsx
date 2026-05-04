"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QueendomPanel from "./QueendomPanel";
import OnboardingPanel from "./onboarding/OnboardingPanel";
import QueendomSkeleton from "./skeletons/QueendomSkeleton";
import OnboardingSkeleton from "./skeletons/OnboardingSkeleton";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import type { QueenStats } from "@/lib/types";
import type { ActiveScreen, RenewalsPanelData } from "@/types";

export type { ActiveScreen };

const SCREEN_DURATIONS_MS: Record<ActiveScreen, number> = {
  concierge: 30_000,
  onboarding: 30_000,
};

const fadeTransition = {
  duration: 1.5,
  ease: "easeInOut" as const,
};

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

/** TV browsers / remotes often omit `key` or use legacy keyCode; fullscreen can eat events before bubble. */
function isFreezeToggleKey(e: KeyboardEvent): boolean {
  if (e.key === "p" || e.key === "P") return true;
  if (e.key === " " || e.code === "Space") return true;
  if (e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter") return true;
  if (e.code === "MediaPlayPause") return true;
  // Legacy WebKit / embedded TV engines
  if (typeof e.keyCode === "number" && e.keyCode === 13) return true;
  return false;
}

// Shared exit transition for skeleton overlays — matches the cinematic 1.5s
// Corporate fade — skeleton dissolves smoothly without fighting the content entrance.
const skeletonExitTransition = { duration: 0.7, ease: [0.4, 0, 0.2, 1] as const };

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
      setActiveScreen((s) => (s === "concierge" ? "onboarding" : "concierge"));
    }, SCREEN_DURATIONS_MS[activeScreen]);

    return () => window.clearTimeout(timeoutId);
  }, [activeScreen, isFrozen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isFreezeToggleKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        setIsFrozen((v) => !v);
        return;
      }
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      setActiveScreen((s) => (s === "concierge" ? "onboarding" : "concierge"));
    };
    // Capture: run before other handlers / fullscreen UI; helps TV + embedded browsers.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <div
      className={`relative h-full w-full min-h-0 min-w-0 overflow-hidden ${className ?? ""}`}
    >
      {/* Always clickable: TV remotes often fail to deliver Enter to window; use pointer + P key + OK */}
      <button
        type="button"
        aria-pressed={isFrozen}
        aria-label={isFrozen ? "Resume auto-switching" : "Pause on this screen"}
        className={`absolute right-3 top-3 z-[100] min-h-[48px] min-w-[140px] rounded-full border px-5 py-2.5 font-inter text-base font-semibold tracking-[0.2em] shadow-lg backdrop-blur-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/80 ${
          isFrozen
            ? "border-emerald-500/50 bg-emerald-950/75 text-emerald-200"
            : "border-gold-500/40 bg-black/50 text-gold-200 hover:bg-black/65"
        }`}
        onClick={() => setIsFrozen((v) => !v)}
      >
        {isFrozen ? "RESUME" : "PAUSE"}
      </button>

      {/* Screens stay mounted; only opacity/z-index changes (cinematic crossfade, no translateX tearing). */}
      <motion.div
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: activeScreen === "concierge" ? "auto" : "none" }}
        initial={false}
        animate={{
          opacity: activeScreen === "concierge" ? 1 : 0,
          zIndex: activeScreen === "concierge" ? 10 : 0,
        }}
        transition={fadeTransition}
      >
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
            <AnimatePresence>
              {isInitialLoading && (
                <motion.div
                  className="absolute inset-0 z-20"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={skeletonExitTransition}
                >
                  <QueendomSkeleton side="left" />
                </motion.div>
              )}
            </AnimatePresence>
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
            <AnimatePresence>
              {isInitialLoading && (
                <motion.div
                  className="absolute inset-0 z-20"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ ...skeletonExitTransition, delay: 0.15 }}
                >
                  <QueendomSkeleton side="right" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: activeScreen === "onboarding" ? "auto" : "none" }}
        initial={false}
        animate={{
          opacity: activeScreen === "onboarding" ? 1 : 0,
          zIndex: activeScreen === "onboarding" ? 10 : 0,
        }}
        transition={fadeTransition}
      >
        {/* Onboarding screen — isolated from the concierge screens */}
        <div className="relative flex min-h-0 h-full w-full min-w-0 flex-col">
          <ErrorBoundary label="Onboarding" fillParent>
            <OnboardingPanel />
          </ErrorBoundary>
          {/* Skeleton overlay — staggered 0.3s so the left→right→onboarding cascade feels intentional */}
          <AnimatePresence>
            {isInitialLoading && (
              <motion.div
                className="absolute inset-0 z-20"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ ...skeletonExitTransition, delay: 0.3 }}
              >
                <OnboardingSkeleton />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
