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
import { AgentRow, GRID_STYLE } from "./AgentRow";
import { fh, fw } from "@/lib/tvScale";

/** Column caption (handoff §B2: 44px, .22em) — colour varies per column. */
const HEADER_CLASS = "font-cinzel font-semibold uppercase leading-[1.15] text-center";
const HEADER_STYLE = { fontSize: fw(44), letterSpacing: "0.22em" };

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
        <div className="grid" style={{ ...GRID_STYLE, paddingBottom: fh(24) }}>
          <span />
          <span className={`${HEADER_CLASS} text-amber-300/95`} style={HEADER_STYLE}>
            Genies
          </span>
          <span className={`${HEADER_CLASS} text-green-400`} style={HEADER_STYLE}>
            Today
          </span>
          <span className={`${HEADER_CLASS} text-champagne`} style={HEADER_STYLE}>
            Monthly
          </span>
          <span className={`${HEADER_CLASS} text-red-400`} style={HEADER_STYLE}>
            Pending
          </span>
        </div>
      </div>

      {/* ── Agent rows ───────────────────────────────────────────────────── */}
      <div style={{ paddingTop: fh(14) }}>
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
