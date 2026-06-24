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
import { AgentRow, GRID_COLS, GRID_GAP_X } from "./AgentRow";

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
      {/* bg is 98% opaque — backdrop blur was invisible but cost a GPU pass on TV */}
      <div className="z-10 bg-obsidian/98 border-b border-gold-500/20 flex-shrink-0">
        <div className={`grid ${GRID_COLS} ${GRID_GAP_X} pb-[0.9cqh]`}>
          <span />
          <span className="font-montserrat text-[clamp(1.5rem,2.5cqw,3rem)] tracking-[0.4em] uppercase text-amber-300/95 font-semibold text-center">
            Genies
          </span>
          <span className="font-montserrat text-[clamp(1.5rem,2.5cqw,3rem)] tracking-[0.4em] uppercase text-green-400 font-semibold text-center">
            Today
          </span>
          <span className="font-montserrat text-[clamp(1.5rem,2.5cqw,3rem)] tracking-[0.4em] uppercase text-champagne font-semibold text-center">
            Monthly
          </span>
          <span className="font-montserrat text-[clamp(1.5rem,2.5cqw,3rem)] tracking-[0.4em] uppercase text-red-400 font-semibold text-center">
            Pending
          </span>
        </div>
      </div>

      {/* ── Agent rows ───────────────────────────────────────────────────── */}
      <div className="pt-[0.5cqh]">
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
