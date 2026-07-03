"use client";

/**
 * components/leaderboard/AgentRow.tsx
 *
 * A single row in the agent leaderboard.
 * Memoized — only re-renders when its agent prop changes (no parent re-render cascade).
 *
 * Neumorphic live reorder: the row is absolutely positioned by rank
 * (`top = index / totalAgents`) inside AgentLeaderboard's relative region and
 * keeps a stable DOM slot — a rank change only retargets `top`, which glides
 * over 850ms (--neu-dur-reorder / --neu-ease-glide). Top-3 ranks get warm
 * accent-wash plinths (8/7/4%); there are no rank medals.
 *
 * Also exports:
 *   GRID_COLS — the Tailwind responsive grid template shared with the header in
 *               AgentLeaderboard.tsx (single source of truth for column widths).
 */

import { memo, useRef, useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import type { AgentStats } from "@/lib/types";
import { rowVariants, gpuStyle } from "@/lib/motionPresets";
import { usePrevious } from "@/hooks/usePrevious";
import { AnimatedValue } from "@/components/AnimatedValue";
import { AgentIcon } from "./AgentIcon";

// ── Shared grid template (header + every row must match exactly) ──────────────
// Exported so AgentLeaderboard.tsx uses the same string without duplication.
export const GRID_COLS =
  "grid-cols-[3.5rem_minmax(0,2fr)_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)_minmax(6.75rem,1.1fr)] " +
  "sm:grid-cols-[4.5rem_minmax(0,2fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(8rem,1.1fr)] " +
  "lg:grid-cols-[5.5rem_minmax(0,2fr)_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(9rem,1.1fr)] " +
  "xl:grid-cols-[5.5rem_minmax(0,2fr)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)_minmax(9.5rem,1.1fr)]";

// Fluid column gap + horizontal padding — shared by header and rows so they
// stay pixel-aligned at every viewport size (tokens in globals.css).
export const GRID_GAP_X = "gap-x-[var(--gap-row-x)] px-[var(--pad-row-x)]";

// Top-3 accent-wash strengths (percent of --neu-accent mixed into the row bg).
const RANK_WASH_PCT = [8, 7, 4] as const;

// ── AgentRow ──────────────────────────────────────────────────────────────────
export interface AgentRowProps {
  agent: AgentStats;
  /** Rank (0-based) — drives the absolute `top` position, not DOM order. */
  index: number;
  totalAgents: number;
  baseDelay: number;
  isWinning: boolean;
}

export const AgentRow = memo(function AgentRow({
  agent,
  index,
  totalAgents,
  baseDelay,
  isWinning,
}: AgentRowProps) {
  const rowDelay = baseDelay + index * 0.07;
  const ringDelay = rowDelay + 0.25;
  const rank = index + 1;
  const n = Math.max(totalAgents, 1);

  const received = agent.tasksAssignedToday ?? 0;
  const today = agent.tasksCompletedToday ?? 0;
  const todayPct = received > 0 ? today / received : 0;

  const prevToday = usePrevious(today);
  const prevPending = usePrevious(agent.pendingScore ?? 0);
  const [surgeKey, setSurgeKey] = useState(0);

  // Memoised pending / overdue — stable across unrelated re-renders
  const { pending, overdue, incomplete } = useMemo(
    () => ({
      pending: agent.pendingScore ?? 0,
      overdue: agent.overdueCount ?? 0,
      incomplete: agent.incomplete ?? 0,
    }),
    [agent.pendingScore, agent.overdueCount, agent.incomplete],
  );
  const hasOverdue = overdue > 0;

  // Suppress surges during the first 1.5 s after mount so the initial WebSocket
  // data population (0 → N) never triggers the flash on the opening animation.
  const mountTimeRef = useRef(Date.now());

  // Trigger surge flash when today-score or pending count increases
  useEffect(() => {
    if (Date.now() - mountTimeRef.current < 1500) return;
    const todayIncreased = prevToday !== undefined && today > prevToday;
    const pendingIncreased = prevPending !== undefined && pending > prevPending;
    if (todayIncreased || pendingIncreased) setSurgeKey((n) => n + 1);
  }, [today, pending, prevToday, prevPending]);

  return (
    <motion.div
      variants={rowVariants}
      custom={rowDelay}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{
        ...gpuStyle,
        top: `${(index * 100) / n}%`,
        height: `calc(${(100 / n).toFixed(3)}% - 0.2cqh)`,
        transition: "top var(--neu-dur-reorder) var(--neu-ease-glide)",
        background:
          index < 3
            ? `color-mix(in srgb, var(--neu-accent) ${RANK_WASH_PCT[index]}%, transparent)`
            : "transparent",
        boxShadow: index === 0 ? "var(--neu-shadow-raised-sm)" : "none",
      }}
      className="absolute inset-x-0 overflow-hidden rounded-neu-chip"
    >
      {/* ── Surge: honey-gold sweep across the row on score increase ────────
          Keyed remount replays the CSS neu-sweep run (ends at opacity 0,
          fill-mode both, so the layer stays invisible after the pass). */}
      {surgeKey > 0 && (
        <div
          key={`surge-sweep-${surgeKey}`}
          className="absolute inset-0 pointer-events-none z-[2] overflow-hidden rounded-neu-chip"
        >
          <div
            className="absolute inset-y-0 w-[40%]"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, var(--neu-accent) 45%, transparent), transparent)",
              animation: "neu-sweep 0.9s ease-out 1 both",
              ...gpuStyle,
            }}
          />
        </div>
      )}

      {/* ── Win sweep: while celebration is active ────────────────────────── */}
      {isWinning && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-y-0 w-[50%]"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, var(--neu-accent) 35%, transparent), color-mix(in srgb, var(--neu-accent) 55%, transparent), transparent)",
              animation: "neu-sweep 1.2s ease-out infinite",
            }}
          />
        </motion.div>
      )}

      {/* ── Data grid ─────────────────────────────────────────────────────── */}
      <div
        className={`grid h-full ${GRID_COLS} items-center ${GRID_GAP_X} rounded-neu-chip relative z-[3]`}
      >
        {/* Col 1: Icon — subtle scale pulse on surge, never distorting */}
        <motion.div
          className="ml-2 sm:ml-3 lg:ml-4"
          style={gpuStyle}
          animate={
            surgeKey > 0
              ? { scale: [1, 1.14, 1], opacity: [1, 0.88, 1] }
              : { scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <AgentIcon
            name={agent.name}
            pct={todayPct}
            animDelay={ringDelay}
            showCrown={rank === 1}
          />
        </motion.div>

        {/* Col 2: Agent name — opacity dip on surge; row-level sweep carries the drama */}
        <motion.p
          className="min-w-0 font-cinzel font-semibold text-[clamp(1.9rem,3.1cqw,3.9rem)] tracking-wide text-neu-t1 leading-none text-center truncate px-1"
          style={gpuStyle}
          animate={surgeKey > 0 ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          {agent.name}
        </motion.p>

        {/* Col 3: Today — completed / assigned; numeral squash-pops on surge */}
        <div className="flex items-baseline justify-center gap-1 sm:gap-2">
          <span
            key={`pop-${surgeKey}`}
            className={surgeKey > 0 ? "neu-anim-pop inline-flex" : "inline-flex"}
          >
            <AnimatedValue
              value={today}
              className="font-montserrat text-[clamp(2.325rem,3.675cqw,4.65rem)] leading-none text-neu-sage-deep tabular-nums font-bold"
              highlightOnIncrease
            />
          </span>
          <span className="font-montserrat text-[clamp(1.275rem,1.575cqw,2.025rem)] text-neu-t3 leading-none">
            /
          </span>
          <AnimatedValue
            value={received}
            className="font-montserrat text-[clamp(1.65rem,2.175cqw,2.7rem)] text-neu-t3 leading-none tabular-nums"
          />
        </div>

        {/* Col 4: Monthly — completed / assigned */}
        <div className="flex items-baseline justify-center gap-1 sm:gap-2">
          <AnimatedValue
            value={agent.tasksCompletedThisMonth ?? 0}
            className="font-montserrat tabular-nums font-semibold leading-none text-[clamp(2.325rem,3.675cqw,4.65rem)] text-neu-t2"
          />
          <span className="font-montserrat text-[clamp(1.275rem,1.575cqw,2.025rem)] text-neu-t3 leading-none">
            /
          </span>
          <AnimatedValue
            value={agent.tasksAssignedThisMonth ?? 0}
            className="font-montserrat text-[clamp(1.65rem,2.175cqw,2.7rem)] text-neu-t3 leading-none tabular-nums"
          />
        </div>

        {/* Col 5: Pending / Overdue / Incomplete */}
        <div className="flex items-baseline justify-center gap-0.5 sm:gap-1">
          <AnimatedValue
            value={pending}
            className="font-montserrat text-[clamp(1.875rem,2.85cqw,3.75rem)] leading-none tabular-nums font-semibold text-neu-t2"
            highlightOnIncrease
          />
          <span className="font-montserrat text-[clamp(1.875rem,2.85cqw,3.75rem)] leading-none tabular-nums font-bold text-neu-t3">
            /
          </span>
          <AnimatedValue
            value={overdue}
            className={`font-montserrat text-[clamp(1.875rem,2.85cqw,3.75rem)] leading-none tabular-nums font-bold ${
              hasOverdue ? "text-neu-danger-deep" : "text-neu-t3"
            }`}
          />
          <span className="font-montserrat text-[clamp(1.875rem,2.85cqw,3.75rem)] leading-none tabular-nums font-bold text-neu-t3">
            /
          </span>
          <AnimatedValue
            value={incomplete}
            className="font-montserrat text-[clamp(1.875rem,2.85cqw,3.75rem)] leading-none tabular-nums font-semibold text-neu-butter-deep"
            highlightOnIncrease
          />
        </div>
      </div>
    </motion.div>
  );
});
