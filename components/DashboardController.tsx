"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import QueendomPanel from "./QueendomPanel";
import OnboardingPanel from "./OnboardingPanel";
import type { QueenStats } from "@/lib/types";

export type ActiveScreen = "concierge" | "onboarding";

const SCREEN_DURATIONS_MS: Record<ActiveScreen, number> = {
  concierge: 40_000,
  onboarding: 20_000,
};

const slideTransition = {
  type: "tween" as const,
  ease: "easeInOut" as const,
  duration: 0.8,
};

interface RenewalsPanelData {
  totalRenewalsThisMonth: number;
  renewals: string[];
  assignments: string[];
}

interface DashboardControllerProps {
  className?: string;
  ananyshreeStats: QueenStats;
  anishqaStats: QueenStats;
  renewalsAnanyshree: RenewalsPanelData;
  renewalsAnishqa: RenewalsPanelData;
  celebrationAgent: string | null;
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

export default function DashboardController({
  className,
  ananyshreeStats,
  anishqaStats,
  renewalsAnanyshree,
  renewalsAnishqa,
  celebrationAgent,
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
      className={`relative flex min-h-0 w-full min-w-0 flex-1 flex-col ${className ?? ""}`}
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
      {/* Viewport: overflow hidden + flex-1 fills space between TopBar and ticker (not literal 100vh, which would stack past the ticker) */}
      <div className="flex min-h-0 min-w-0 h-full w-full flex-1 flex-col overflow-hidden">
        <motion.div
          className="flex h-full"
          style={{
            width: "200%",
            height: "100%",
            willChange: "transform",
          }}
          initial={false}
          animate={{
            x: activeScreen === "concierge" ? "0%" : "-50%",
          }}
          transition={slideTransition}
        >
          <div
            className="flex min-h-0 h-full min-w-0 shrink-0 flex-col gap-8 md:flex-row md:items-stretch"
            style={{ width: "50%", flexShrink: 0 }}
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col md:basis-0">
              <QueendomPanel
                name="Ananyshree"
                stats={ananyshreeStats}
                side="left"
                delay={0}
                celebrationAgent={celebrationAgent}
                renewalsData={renewalsAnanyshree}
              />
            </div>

            {/* Center column — full-height gold separator between Queendoms (md+) */}
            <div
              className="relative hidden shrink-0 self-stretch md:block"
              style={{ width: "36px" }}
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

            <div className="flex min-h-0 min-w-0 flex-1 flex-col md:basis-0">
              <QueendomPanel
                name="Anishqa"
                stats={anishqaStats}
                side="right"
                delay={150}
                celebrationAgent={celebrationAgent}
                renewalsData={renewalsAnishqa}
              />
            </div>
          </div>

          <div
            className="flex min-h-0 h-full min-w-0 shrink-0 flex-col"
            style={{ width: "50%", flexShrink: 0 }}
          >
            <OnboardingPanel />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
