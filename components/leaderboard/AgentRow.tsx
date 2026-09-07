"use client";

/**
 * components/leaderboard/AgentRow.tsx
 *
 * A single row in the agent leaderboard.
 * Memoized — only re-renders when its agent prop changes (no parent re-render cascade).
 *
 * Also exports:
 *   GRID_STYLE — the grid template shared with the header in
 *               AgentLeaderboard.tsx (single source of truth for column widths).
 */

import { memo, useRef, useEffect, useState, useMemo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { AgentStats } from "@/lib/types";
import {
  rowVariants,
  gpuStyle,
  surgeBgVariants,
  surgeSweepVariants,
  surgeSweepBarVariants,
  winShimmerBarVariants,
} from "@/lib/motionPresets";
import { usePrevious } from "@/hooks/usePrevious";
import { fh, fw } from "@/lib/tvScale";
import { AnimatedValue } from "@/components/AnimatedValue";
import { AgentIcon } from "./AgentIcon";

// ── Shared grid template (header + every row must match exactly) ──────────────
// Handoff 1c §B2: `72px minmax(0,2fr) minmax(150px,1fr) minmax(150px,1fr)
// minmax(210px,1.1fr)`, column-gap 30px, horizontal padding 14px — expressed
// through lib/tvScale so the TV stage renders those exact pixels and smaller
// viewports scale proportionally. Exported so AgentLeaderboard.tsx uses the
// same object without duplication.
export const GRID_STYLE: CSSProperties = {
  gridTemplateColumns: `${fw(72)} minmax(0,2fr) minmax(${fw(150)},1fr) minmax(${fw(150)},1fr) minmax(${fw(210)},1.1fr)`,
  columnGap: fw(30),
  paddingLeft: fw(14),
  paddingRight: fw(14),
};

/** Row vertical padding (handoff: 20px; drop to 12 first if a roster exceeds 10). */
const ROW_PAD_Y = fh(20);

// ── Cell type sizes (handoff §B2, stage px) ───────────────────────────────────
const NAME_STYLE: CSSProperties = { fontSize: fw(54), letterSpacing: "0.025em" };
const BIG_STYLE: CSSProperties = { fontSize: fw(66) };
const SLASH_STYLE: CSSProperties = { fontSize: fw(29) };
const DENOM_STYLE: CSSProperties = { fontSize: fw(38) };
const PENDING_STYLE: CSSProperties = { fontSize: fw(54) };
const PAIR_GAP: CSSProperties = { gap: fw(7) };
const TRIPLE_GAP: CSSProperties = { gap: fw(3.6) };

// ── AgentRow ──────────────────────────────────────────────────────────────────
export interface AgentRowProps {
  agent: AgentStats;
  index: number;
  totalAgents: number;
  baseDelay: number;
  isWinning: boolean;
}

export const AgentRow = memo(function AgentRow({
  agent,
  index,
  baseDelay,
  isWinning,
}: AgentRowProps) {
  const rowDelay = baseDelay + index * 0.07;
  const ringDelay = rowDelay + 0.25;
  const rank = index + 1;

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
      style={gpuStyle}
      className="relative overflow-hidden rounded-xl"
    >
      {/* ── Surge flash: gold burst on score increase (presets: motionPresets) ── */}
      {surgeKey > 0 && (
        <motion.div
          key={`surge-bg-${surgeKey}`}
          className="absolute inset-0 pointer-events-none z-[1] rounded-xl"
          style={{
            backgroundColor: "rgba(201,168,76,0.3)",
            ...gpuStyle,
          }}
          {...surgeBgVariants}
        />
      )}
      {surgeKey > 0 && (
        <motion.div
          key={`surge-sweep-${surgeKey}`}
          className="absolute inset-0 pointer-events-none z-[2] overflow-hidden rounded-xl"
          style={gpuStyle}
          {...surgeSweepVariants}
        >
          <motion.div
            className="absolute inset-y-0 w-[45%]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.82) 20%, transparent 100%)",
              ...gpuStyle,
            }}
            {...surgeSweepBarVariants}
          />
        </motion.div>
      )}

      {/* ── Win shimmer: continuous sweep while celebration is active ─────── */}
      {isWinning && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="absolute inset-y-0 w-[50%]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(249,226,126,0.35), rgba(249,226,126,0.6), rgba(249,226,126,0.35), transparent)",
            }}
            {...winShimmerBarVariants}
          />
        </motion.div>
      )}

      {/* ── Data grid ─────────────────────────────────────────────────────── */}
      <div
        className="grid items-center rounded-xl group relative z-[3]"
        style={{ ...GRID_STYLE, paddingTop: ROW_PAD_Y, paddingBottom: ROW_PAD_Y }}
      >
        {/* Col 1: Icon — subtle scale pulse on surge, never distorting */}
        <motion.div
          style={{ ...gpuStyle, marginLeft: fw(6) }}
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

        {/* Col 2: Agent name — opacity dip on surge; row-level gold burst carries the drama */}
        <motion.p
          className="min-w-0 font-cinzel font-semibold text-champagne leading-none text-center truncate px-1"
          style={{ ...gpuStyle, ...NAME_STYLE }}
          animate={surgeKey > 0 ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          {agent.name}
        </motion.p>

        {/* Col 3: Today — completed / assigned */}
        <div className="flex items-baseline justify-center" style={PAIR_GAP}>
          <AnimatedValue
            value={today}
            className="font-montserrat leading-none text-green-400 tabular-nums font-semibold"
            style={BIG_STYLE}
            highlightOnIncrease
          />
          <span className="font-montserrat text-white/25 leading-none" style={SLASH_STYLE}>
            /
          </span>
          <AnimatedValue
            value={received}
            className="font-montserrat text-white/40 leading-none tabular-nums"
            style={DENOM_STYLE}
          />
        </div>

        {/* Col 4: Monthly — completed / assigned */}
        <div className="flex items-baseline justify-center" style={PAIR_GAP}>
          <AnimatedValue
            value={agent.tasksCompletedThisMonth ?? 0}
            className="font-montserrat tabular-nums font-semibold leading-none"
            style={{ ...BIG_STYLE, color: "rgba(212,175,55,0.9)" }}
          />
          <span className="font-montserrat text-white/25 leading-none" style={SLASH_STYLE}>
            /
          </span>
          <AnimatedValue
            value={agent.tasksAssignedThisMonth ?? 0}
            className="font-montserrat text-white/40 leading-none tabular-nums"
            style={DENOM_STYLE}
          />
        </div>

        {/* Col 5: Pending / Overdue / Incomplete */}
        <div className="flex items-baseline justify-center" style={TRIPLE_GAP}>
          <AnimatedValue
            value={pending}
            className="font-montserrat leading-none tabular-nums font-semibold text-red-400"
            style={PENDING_STYLE}
            highlightOnIncrease
          />
          <span className="font-montserrat leading-none tabular-nums font-bold text-white/30" style={PENDING_STYLE}>
            /
          </span>
          <AnimatedValue
            value={overdue}
            className={`font-montserrat leading-none tabular-nums font-bold ${
              hasOverdue ? "error-overdue-glow" : "text-white/40"
            }`}
            style={PENDING_STYLE}
          />
          <span className="font-montserrat leading-none tabular-nums font-bold text-white/30" style={PENDING_STYLE}>
            /
          </span>
          <AnimatedValue
            value={incomplete}
            className="font-montserrat leading-none tabular-nums font-semibold text-slate-200/60"
            style={PENDING_STYLE}
            highlightOnIncrease
          />
        </div>
      </div>

      {/* Row separator */}
      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-gold-500/[0.08] to-transparent" />
    </motion.div>
  );
});
