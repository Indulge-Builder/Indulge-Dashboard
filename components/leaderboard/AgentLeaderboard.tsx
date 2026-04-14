"use client";

/**
 * components/leaderboard/AgentLeaderboard.tsx
 *
 * Thin container component: sticky column header + AnimatePresence row list.
 * All animation and data logic lives in AgentRow / AgentIcon.
 *
 * Props mirror the old components/AgentLeaderboard.tsx exactly so QueendomPanel
 * needs only a path change, not a signature change.
 */

import { AnimatePresence } from "framer-motion";
import type { AgentStats } from "@/lib/types";
import { AgentRow, GRID_COLS } from "./AgentRow";

// ── Props ─────────────────────────────────────────────────────────────────────
interface AgentLeaderboardProps {
  agents:            AgentStats[];
  queendomDelay?:    number;
  celebrationAgent?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AgentLeaderboard({
  agents,
  queendomDelay    = 0,
  celebrationAgent = null,
}: AgentLeaderboardProps) {
  return (
    <div className="flex w-full flex-col">
      {/* ── Sticky column header ─────────────────────────────────────────── */}
      <div className="z-10 bg-obsidian/98 border-b border-gold-500/20 flex-shrink-0 backdrop-blur-sm">
        <div className={`grid ${GRID_COLS} gap-x-3 sm:gap-x-4 lg:gap-x-5 px-2 sm:px-3 pb-[0.9vh]`}>
          <span />
          <span className="font-inter text-[clamp(1.05rem,1.4vw,1.6rem)] tracking-[0.4em] uppercase text-amber-300/95 font-semibold text-center">
            Genies
          </span>
          <span className="font-inter text-[clamp(1.05rem,1.4vw,1.6rem)] tracking-[0.4em] uppercase text-green-400 font-semibold text-center">
            Today
          </span>
          <span className="font-inter text-[clamp(1.05rem,1.4vw,1.6rem)] tracking-[0.4em] uppercase text-champagne font-semibold text-center">
            Monthly
          </span>
          <span className="font-inter text-[clamp(1.05rem,1.4vw,1.6rem)] tracking-[0.4em] uppercase text-red-400 font-semibold text-center">
            Pending
          </span>
        </div>
      </div>

      {/* ── Agent rows ───────────────────────────────────────────────────── */}
      <div className="pt-[0.5vh]">
        <AnimatePresence>
          {agents.map((agent, i) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              index={i}
              totalAgents={agents.length}
              baseDelay={queendomDelay}
              isWinning={
                celebrationAgent !== null &&
                agent.name.toLowerCase() === celebrationAgent.toLowerCase()
              }
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
