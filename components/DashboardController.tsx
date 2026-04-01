"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QueendomPanel from "./QueendomPanel";
import OnboardingPanel from "./OnboardingPanel";
import type { QueenStats } from "@/lib/types";

export type ActiveScreen = "concierge" | "onboarding";

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

const blurTransition = {
  duration: 1.35,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

const screenVariants = {
  initial: { opacity: 0, filter: "blur(4px)" },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    transition: blurTransition,
  },
  exit: {
    opacity: 0,
    filter: "blur(4px)",
    transition: blurTransition,
  },
};

export default function DashboardController({
  className,
  ananyshreeStats,
  anishqaStats,
  renewalsAnanyshree,
  renewalsAnishqa,
  celebrationAgent,
}: DashboardControllerProps) {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("concierge");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      setActiveScreen((s) => (s === "concierge" ? "onboarding" : "concierge"));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className={`relative flex min-h-0 w-full min-w-0 flex-1 ${className ?? ""}`}
    >
      <AnimatePresence mode="wait">
        {activeScreen === "concierge" ? (
          <motion.div
            key="concierge"
            className="flex w-full flex-1 min-h-0 min-w-0 flex-col gap-8 md:flex-row md:items-stretch"
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
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
          </motion.div>
        ) : (
          <motion.div
            key="onboarding"
            className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
            variants={screenVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <OnboardingPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
