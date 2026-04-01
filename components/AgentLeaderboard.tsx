"use client";

import { memo, useRef, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown } from "lucide-react";
import type { AgentStats } from "@/lib/types";
import { safeNum } from "@/components/QueendomPanel";

// ── Ring constants ───────────────────────────────────────────────────────────
const RING_SIZE = 80;
const RING_R = 32;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

// ── Grid: [Icon | Name | Today | Monthly | Pending this month / Overdue] ───────
// Metric columns: minmax + 1fr so extra width in this panel flows into Today / Monthly / Pending.
const GRID_COLS =
  "grid-cols-[3.5rem_minmax(0,2fr)_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)] " +
  "sm:grid-cols-[4.5rem_minmax(0,2fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)] " +
  "lg:grid-cols-[5.5rem_minmax(0,2fr)_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)] " +
  "xl:grid-cols-[5.5rem_minmax(0,2fr)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)_minmax(9.5rem,1fr)]";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// ── Animated value with flash on change ──────────────────────────────────────
interface AnimatedValueProps {
  value: number;
  className?: string;
  style?: React.CSSProperties;
  highlightOnIncrease?: boolean;
}

const AnimatedValue = memo(function AnimatedValue({
  value,
  className,
  style,
  highlightOnIncrease = false,
}: AnimatedValueProps) {
  const prev = usePrevious(value);
  const [changePulse, setChangePulse] = useState(0);
  const increased = prev !== undefined && value > prev;

  useEffect(() => {
    if (prev !== undefined && prev !== value) {
      setChangePulse((n) => n + 1);
    }
  }, [prev, value]);

  return (
    <span
      className={`relative inline-grid place-items-center ${className ?? ""}`}
      style={style}
    >
      <motion.span
        key={`base-${changePulse}-${value}`}
        style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
        animate={
          increased
            ? { scale: [1.3, 1], opacity: [0.85, 1] }
            : { scale: 1, opacity: 1 }
        }
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {value}
      </motion.span>
      {highlightOnIncrease && increased && (
        <motion.span
          key={`emerald-${changePulse}-${value}`}
          className="absolute inset-0 grid place-items-center text-emerald-400"
          style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
          initial={{ opacity: 0.95, scale: 1.3 }}
          animate={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          aria-hidden
        >
          {value}
        </motion.span>
      )}
    </span>
  );
});

// ── Icon: Circular gold border, initials ──────────────────────────────────
interface AgentIconProps {
  name: string;
  pct: number;
  animDelay: number;
  showCrown?: boolean;
}

const AgentIcon = memo(function AgentIcon({
  name,
  pct,
  animDelay,
  showCrown,
}: AgentIconProps) {
  const clampedPct = Math.min(Math.max(pct, 0), 1);
  const offset = CIRCUMFERENCE * (1 - clampedPct);

  return (
    <div className="relative flex-shrink-0 w-[44px] h-[44px] sm:w-[56px] sm:h-[56px] lg:w-[72px] lg:h-[72px]">
      <svg
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 -rotate-90 w-full h-full"
        style={{ overflow: "visible" }}
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="2.5"
        />
        <motion.circle
          key={offset}
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="#c9a84c"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            type: "tween",
            duration: 1.2,
            ease: "easeOut",
            delay: animDelay,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center rounded-full border border-gold-500/30">
        <span className="font-cinzel text-[0.6rem] sm:text-[0.8rem] lg:text-[1rem] tracking-widest text-gold-400 select-none">
          {getInitials(name)}
        </span>
      </div>
      {showCrown && (
        <div className="absolute -top-[8px] sm:-top-[10px] lg:-top-[12px] left-1/2 -translate-x-1/2 z-10">
          <Crown className="text-gold-400 w-[12px] h-[12px] sm:w-[15px] sm:h-[15px] lg:w-[18px] lg:h-[18px]" />
        </div>
      )}
    </div>
  );
});

// ── Row variants ────────────────────────────────────────────────────────────
const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94], delay },
  }),
  exit: { opacity: 0, transition: { duration: 0.25 } },
};

// ── Agent Row (memoized for 60fps) ────────────────────────────────────────────
interface AgentRowProps {
  agent: AgentStats;
  index: number;
  totalAgents: number;
  baseDelay: number;
  isWinning: boolean;
}

const AgentRow = memo(function AgentRow({
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

  // Memoized Error column counts — stable during WebSocket updates
  const { pending, overdue } = useMemo(
    () => ({
      pending: agent.pendingScore ?? 0,
      overdue: agent.overdueCount ?? 0,
    }),
    [agent.pendingScore, agent.overdueCount],
  );
  const hasOverdue = overdue > 0;

  useEffect(() => {
    const todayIncreased = prevToday !== undefined && today > prevToday;
    const pendingIncreased =
      prevPending !== undefined && pending > prevPending;
    if (todayIncreased || pendingIncreased) {
      setSurgeKey((n) => n + 1);
    }
  }, [today, pending, prevToday, prevPending]);

  return (
    <motion.div
      variants={rowVariants}
      custom={rowDelay}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
      className="relative overflow-hidden rounded-xl"
    >
      {surgeKey > 0 && (
        <motion.div
          key={`surge-bg-${surgeKey}`}
          className="absolute inset-0 pointer-events-none z-[1] rounded-xl"
          style={{
            backgroundColor: "rgba(201,168,76,0.3)",
            willChange: "transform, opacity",
            transform: "translateZ(0)",
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
          style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 1, 0] }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-y-0 w-[45%]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.82) 20%, transparent 100%)",
              willChange: "transform, opacity",
              transform: "translateZ(0)",
            }}
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </motion.div>
      )}

      {/* Win shimmer overlay — travels across row when ticket completed */}
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
            transition={{
              duration: 1.2,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          />
        </motion.div>
      )}

      <div
        className={`grid ${GRID_COLS} items-center gap-x-3 sm:gap-x-4 lg:gap-x-5 px-2 sm:px-3 py-[1vh] sm:py-[1.2vh] rounded-xl transition-colors duration-300 group relative z-[3] hover:bg-white/[0.025]`}
      >
        <motion.div
          className="ml-2 sm:ml-3 lg:ml-4"
          style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
          animate={
            surgeKey > 0
              ? { scale: [1, 4, 1], opacity: [1, 1, 1] }
              : { scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.75, ease: "easeOut" }}
        >
          <AgentIcon
            name={agent.name}
            pct={todayPct}
            animDelay={ringDelay}
            showCrown={rank === 1}
          />
        </motion.div>

        <motion.p
          className="min-w-0 font-baskerville font-semibold text-[clamp(1.425rem,2.325vw,2.925rem)] tracking-wide text-champagne leading-none text-center truncate px-1"
          style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
          animate={
            surgeKey > 0
              ? { scale: [1, 4, 1], opacity: [1, 1, 1] }
              : { scale: 1, opacity: 1 }
          }
          transition={{ duration: 0.75, ease: "easeOut" }}
        >
          {agent.name}
        </motion.p>

        {/* Column 3: Today Score — today / received */}
        <div className="flex items-baseline justify-center gap-1 sm:gap-2">
          <AnimatedValue
            value={today}
            className="font-edu text-[clamp(2.325rem,3.675vw,4.65rem)] leading-none text-green-400 tabular-nums font-semibold"
            highlightOnIncrease
          />
          <span className="font-inter text-[clamp(1.275rem,1.575vw,2.025rem)] text-white/25 leading-none">
            /
          </span>
          <AnimatedValue
            value={received}
            className="font-inter text-[clamp(1.65rem,2.175vw,2.7rem)] text-white/40 leading-none tabular-nums"
          />
        </div>

        {/* Column 4: Monthly Score — resolve / received */}
        <div className="flex items-baseline justify-center gap-1 sm:gap-2">
          <AnimatedValue
            value={agent.tasksCompletedThisMonth ?? 0}
            className="font-edu tabular-nums font-semibold leading-none text-[clamp(2.325rem,3.675vw,4.65rem)]"
            style={{
              color:
                rank === 1 ? "rgba(212,175,55,0.9)" : "rgba(190,190,190,0.75)",
            }}
          />
          <span className="font-inter text-[clamp(1.275rem,1.575vw,2.025rem)] text-white/25 leading-none">
            /
          </span>
          <AnimatedValue
            value={agent.tasksAssignedThisMonth ?? 0}
            className="font-inter text-[clamp(1.65rem,2.175vw,2.7rem)] text-white/40 leading-none tabular-nums"
          />
        </div>

        {/* Column 5 — Pending (created this IST month, open) / Overdue (escalated in that set) */}
        <div className="flex items-baseline justify-center gap-1 sm:gap-2">
          <AnimatedValue
            value={pending}
            className="font-edu text-[clamp(2.025rem,3.075vw,4.125rem)] leading-none tabular-nums font-semibold text-red-400"
            highlightOnIncrease
          />
          <span className="font-edu text-[clamp(2.025rem,3.075vw,4.125rem)] leading-none tabular-nums font-bold text-white/30">
            /
          </span>
          <AnimatedValue
            value={overdue}
            className={`font-edu text-[clamp(2.025rem,3.075vw,4.125rem)] leading-none tabular-nums font-bold ${
              hasOverdue ? "error-overdue-glow" : "text-white/40"
            }`}
          />
        </div>
      </div>

      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-gold-500/[0.08] to-transparent" />
    </motion.div>
  );
});

// ── Leaderboard ──────────────────────────────────────────────────────────────
interface AgentLeaderboardProps {
  agents: AgentStats[];
  queendomDelay?: number;
  celebrationAgent?: string | null;
}

export default function AgentLeaderboard({
  agents,
  queendomDelay = 0,
  celebrationAgent = null,
}: AgentLeaderboardProps) {
  return (
    <div className="flex w-full flex-col">
      <div className="z-10 bg-obsidian/98 border-b border-gold-500/20 flex-shrink-0 backdrop-blur-sm">
        <div
          className={`grid ${GRID_COLS} gap-x-3 sm:gap-x-4 lg:gap-x-5 px-2 sm:px-3 pb-[0.9vh]`}
        >
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
