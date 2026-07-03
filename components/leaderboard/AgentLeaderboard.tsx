"use client";

/**
 * components/leaderboard/AgentLeaderboard.tsx
 *
 * Thin container component: column header + live-reorder row list.
 *
 * Live reorder (neumorphic reskin): `agents` arrives rank-ordered from
 * lib/ticketAggregation. Rows are rendered in a STABLE DOM order (sorted by
 * agent id) and absolutely positioned by rank (`top = rank / n`), so a rank
 * change animates `top` (850ms glide in AgentRow) instead of remounting —
 * rows visibly slide past each other on the TV.
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
  // agents is rank-ordered; index there IS the rank.
  const rankById = new Map(agents.map((agent, i) => [agent.id, i]));
  // Stable DOM order (by id) so reorders only move `top`, never DOM nodes.
  const domOrdered = [...agents].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="flex h-full w-full flex-col">
      {/* ── Column header ────────────────────────────────────────────────── */}
      <div className="z-10 border-b border-neu-hairline flex-shrink-0">
        <div className={`grid ${GRID_COLS} ${GRID_GAP_X} pb-[0.9cqh]`}>
          <span />
          <span className="label-field text-neu-t2 text-center">
            Genies
          </span>
          <span className="label-field text-neu-sage-deep text-center">
            Today
          </span>
          <span className="label-field text-neu-t2 text-center">
            Monthly
          </span>
          <span className="label-field text-neu-danger-deep text-center">
            Pending
          </span>
        </div>
      </div>

      {/* ── Agent rows — absolutely positioned by rank inside this region ── */}
      <div className="relative min-h-0 flex-1 mt-[0.5cqh]">
        <AnimatePresence>
          {domOrdered.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              index={rankById.get(agent.id) ?? 0}
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
