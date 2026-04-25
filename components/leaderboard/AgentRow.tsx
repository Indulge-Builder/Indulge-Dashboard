"use client";

/**
 * components/leaderboard/AgentRow.tsx
 *
 * A single row in the agent leaderboard.
 * Memoized — only re-renders when its agent prop changes (no parent re-render cascade).
 *
 * Also exports:
 *   GRID_COLS — the Tailwind responsive grid template shared with the header in
 *               AgentLeaderboard.tsx (single source of truth for column widths).
 *   AnimatedValue — internal numeric display with emerald flash on increase.
 */

import { memo, useRef, useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import type { AgentStats } from "@/lib/types";
import { rowVariants, gpuStyle } from "@/lib/motionPresets";
import { AgentIcon } from "./AgentIcon";

// ── Shared grid template (header + every row must match exactly) ──────────────
// Exported so AgentLeaderboard.tsx uses the same string without duplication.
export const GRID_COLS =
  "grid-cols-[3.5rem_minmax(0,2fr)_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)] " +
  "sm:grid-cols-[4.5rem_minmax(0,2fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)] " +
  "lg:grid-cols-[5.5rem_minmax(0,2fr)_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)] " +
  "xl:grid-cols-[5.5rem_minmax(0,2fr)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)]";

// ── usePrevious ───────────────────────────────────────────────────────────────
// Returns the value from the previous render. Used by AnimatedValue and AgentRow
// to detect increases without any additional state.
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// ── AnimatedValue ─────────────────────────────────────────────────────────────
// Numeric display that pops (scale + optional emerald ghost) when value increases.
// Memoized — stable between renders where value doesn't change.
interface AnimatedValueProps {
  value:               number;
  className?:          string;
  style?:              React.CSSProperties;
  highlightOnIncrease?: boolean;
}

const AnimatedValue = memo(function AnimatedValue({
  value,
  className,
  style,
  highlightOnIncrease = false,
}: AnimatedValueProps) {
  const prev        = usePrevious(value);
  const [changePulse, setChangePulse] = useState(0);
  const increased   = prev !== undefined && value > prev;

  useEffect(() => {
    if (prev !== undefined && prev !== value) {
      setChangePulse((n) => n + 1);
    }
  }, [prev, value]);

  return (
    <span className={`relative inline-grid place-items-center ${className ?? ""}`} style={style}>
      {/* Primary value — pops on increase */}
      <motion.span
        key={`base-${changePulse}-${value}`}
        style={gpuStyle}
        animate={increased ? { scale: [1.3, 1], opacity: [0.85, 1] } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {value}
      </motion.span>

      {/* Emerald ghost layer — fades out on top of the primary value */}
      {highlightOnIncrease && increased && (
        <motion.span
          key={`emerald-${changePulse}-${value}`}
          className="absolute inset-0 grid place-items-center text-emerald-400"
          style={gpuStyle}
          initial={{ opacity: 0.95, scale: 1.3 }}
          animate={{ opacity: 0,    scale: 1   }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          aria-hidden
        >
          {value}
        </motion.span>
      )}
    </span>
  );
});

// ── AgentRow ──────────────────────────────────────────────────────────────────
export interface AgentRowProps {
  agent:       AgentStats;
  index:       number;
  totalAgents: number;
  baseDelay:   number;
  isWinning:   boolean;
}

export const AgentRow = memo(function AgentRow({
  agent,
  index,
  baseDelay,
  isWinning,
}: AgentRowProps) {
  const rowDelay  = baseDelay + index * 0.07;
  const ringDelay = rowDelay + 0.25;
  const rank      = index + 1;

  const received = agent.tasksAssignedToday  ?? 0;
  const today    = agent.tasksCompletedToday ?? 0;
  const todayPct = received > 0 ? today / received : 0;

  const prevToday   = usePrevious(today);
  const prevPending = usePrevious(agent.pendingScore ?? 0);
  const [surgeKey, setSurgeKey] = useState(0);

  // Memoised pending / overdue — stable across unrelated re-renders
  const { pending, overdue } = useMemo(
    () => ({
      pending: agent.pendingScore  ?? 0,
      overdue: agent.overdueCount ?? 0,
    }),
    [agent.pendingScore, agent.overdueCount],
  );
  const hasOverdue = overdue > 0;

  // Suppress surges during the first 1.5 s after mount so the initial WebSocket
  // data population (0 → N) never triggers the flash on the opening animation.
  const mountTimeRef = useRef(Date.now());

  // Trigger surge flash when today-score or pending count increases
  useEffect(() => {
    if (Date.now() - mountTimeRef.current < 1500) return;
    const todayIncreased   = prevToday   !== undefined && today   > prevToday;
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
      {/* ── Surge flash: gold burst on score increase ──────────────────────── */}
      {surgeKey > 0 && (
        <motion.div
          key={`surge-bg-${surgeKey}`}
          className="absolute inset-0 pointer-events-none z-[1] rounded-xl"
          style={{
            backgroundColor: "rgba(201,168,76,0.3)",
            ...gpuStyle,
          }}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: [0.9, 0], scale: [0.98, 1] }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      )}
      {surgeKey > 0 && (
        <motion.div
          key={`surge-sweep-${surgeKey}`}
          className="absolute inset-0 pointer-events-none z-[2] overflow-hidden rounded-xl"
          style={gpuStyle}
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 1, 0] }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-y-0 w-[45%]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.82) 20%, transparent 100%)",
              ...gpuStyle,
            }}
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
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
            initial={{ x: "-100%" }}
            animate={{ x: "300%" }}
            transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </motion.div>
      )}

      {/* ── Data grid ─────────────────────────────────────────────────────── */}
      <div
        className={`grid ${GRID_COLS} items-center gap-x-3 sm:gap-x-4 lg:gap-x-5 px-2 sm:px-3 py-[1vh] sm:py-[1.2vh] rounded-xl transition-colors duration-300 group relative z-[3] hover:bg-white/[0.025]`}
      >
        {/* Col 1: Icon — subtle scale pulse on surge, never distorting */}
        <motion.div
          className="ml-2 sm:ml-3 lg:ml-4"
          style={gpuStyle}
          animate={surgeKey > 0 ? { scale: [1, 1.14, 1], opacity: [1, 0.88, 1] } : { scale: 1, opacity: 1 }}
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
          className="min-w-0 font-baskerville font-semibold text-[clamp(1.425rem,2.325vw,2.925rem)] tracking-wide text-champagne leading-none text-center truncate px-1"
          style={gpuStyle}
          animate={surgeKey > 0 ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          {agent.name}
        </motion.p>

        {/* Col 3: Today — completed / assigned */}
        <div className="flex items-baseline justify-center gap-1 sm:gap-2">
          <AnimatedValue
            value={today}
            className="font-edu text-[clamp(2.325rem,3.675vw,4.65rem)] leading-none text-green-400 tabular-nums font-semibold"
            highlightOnIncrease
          />
          <span className="font-inter text-[clamp(1.275rem,1.575vw,2.025rem)] text-white/25 leading-none">/</span>
          <AnimatedValue
            value={received}
            className="font-inter text-[clamp(1.65rem,2.175vw,2.7rem)] text-white/40 leading-none tabular-nums"
          />
        </div>

        {/* Col 4: Monthly — completed / assigned */}
        <div className="flex items-baseline justify-center gap-1 sm:gap-2">
          <AnimatedValue
            value={agent.tasksCompletedThisMonth ?? 0}
            className="font-edu tabular-nums font-semibold leading-none text-[clamp(2.325rem,3.675vw,4.65rem)]"
            style={{ color: rank === 1 ? "rgba(212,175,55,0.9)" : "rgba(190,190,190,0.75)" }}
          />
          <span className="font-inter text-[clamp(1.275rem,1.575vw,2.025rem)] text-white/25 leading-none">/</span>
          <AnimatedValue
            value={agent.tasksAssignedThisMonth ?? 0}
            className="font-inter text-[clamp(1.65rem,2.175vw,2.7rem)] text-white/40 leading-none tabular-nums"
          />
        </div>

        {/* Col 5: Pending / Overdue — red glow when escalated */}
        <div className="flex items-baseline justify-center gap-1 sm:gap-2">
          <AnimatedValue
            value={pending}
            className="font-edu text-[clamp(2.025rem,3.075vw,4.125rem)] leading-none tabular-nums font-semibold text-red-400"
            highlightOnIncrease
          />
          <span className="font-edu text-[clamp(2.025rem,3.075vw,4.125rem)] leading-none tabular-nums font-bold text-white/30">/</span>
          <AnimatedValue
            value={overdue}
            className={`font-edu text-[clamp(2.025rem,3.075vw,4.125rem)] leading-none tabular-nums font-bold ${
              hasOverdue ? "error-overdue-glow" : "text-white/40"
            }`}
          />
        </div>
      </div>

      {/* Row separator */}
      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-gold-500/[0.08] to-transparent" />
    </motion.div>
  );
});
