"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Trophy, Crown } from "lucide-react";
import type { AgentStats } from "@/lib/types";

// ── Ring constants (scaled up: 62 → 80px) ────────────────────────────────────
const RING_SIZE = 80;
const RING_R = 32;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

// ── Strict 5-column grid: [rank | avatar | name | runrate | monthly] ─────────
// Shared by both the sticky header and every data row for pixel-perfect alignment.
const GRID_COLS = "grid-cols-[2.5rem_5.5rem_1fr_12rem_8rem]";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── Animated number ───────────────────────────────────────────────────────────
// When the value changes (live data update), the numeral performs a soft
// blur-fade-in — subtle enough for ambient viewing, unmistakable for ops staff.
interface AnimatedValueProps {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}

function AnimatedValue({ value, className, style }: AnimatedValueProps) {
  const prevRef = useRef(value);
  const [glowing, setGlowing] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setGlowing(true);
      const t = setTimeout(() => setGlowing(false), 750);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <motion.span
      className={className}
      style={style}
      animate={
        glowing
          ? { opacity: [0.3, 1], filter: ["blur(4px)", "blur(0px)"] }
          : { opacity: 1, filter: "blur(0px)" }
      }
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {value}
    </motion.span>
  );
}

// ── Performance Ring ──────────────────────────────────────────────────────────
// SVG arc progress ring wrapping the agent's initials avatar.
// key={offset} on <motion.circle> forces a remount — and therefore a
// re-animation from zero — on every live data push.
interface RingProps {
  name: string;
  pct: number; // 0 – 1
  animDelay: number;
}

function PerformanceRing({ name, pct, animDelay }: RingProps) {
  const clampedPct = Math.min(Math.max(pct, 0), 1);
  const offset = CIRCUMFERENCE * (1 - clampedPct);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      {/* SVG arc — rotated so the arc starts at 12 o'clock */}
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        className="absolute inset-0 -rotate-90"
        style={{ overflow: "visible" }}
      >
        {/* Faint track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="2.5"
        />
        {/* Warm-gold progress arc */}
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
            duration: 1.8,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: animDelay,
          }}
          style={{ filter: "drop-shadow(0 0 5px rgba(201,168,76,0.40))" }}
        />
      </svg>

      {/* Initials — centered inside the ring, with a hairline circular border */}
      <div
        className="absolute inset-0 flex items-center justify-center rounded-full"
        style={{ border: "1px solid rgba(201,168,76,0.14)" }}
      >
        <span className="font-playfair text-[1.05rem] tracking-widest text-gold-400 select-none">
          {getInitials(name)}
        </span>
      </div>
    </div>
  );
}

// ── Rank badge ────────────────────────────────────────────────────────────────
// Rank 1 shows a glowing crown instead of the numeral "1".
// All other ranks show their number in restrained white/30.
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex justify-end items-center pr-[2px]">
        <Crown
          size={22}
          className="text-gold-400 flex-shrink-0"
          style={{
            filter:
              "drop-shadow(0 0 6px rgba(201,168,76,0.80)) drop-shadow(0 0 14px rgba(201,168,76,0.40))",
          }}
        />
      </div>
    );
  }
  return (
    <span className="font-inter text-[1.6rem] font-semibold tabular-nums text-right block select-none leading-none text-white/30">
      {rank}
    </span>
  );
}

// ── Row variants ──────────────────────────────────────────────────────────────
const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94], delay },
  }),
  exit: { opacity: 0, transition: { duration: 0.25 } },
};

// ── Agent row ─────────────────────────────────────────────────────────────────
interface RowProps {
  agent: AgentStats;
  index: number;
  baseDelay: number;
}

function AgentRow({ agent, index, baseDelay }: RowProps) {
  const rowDelay = baseDelay + index * 0.07;
  const ringDelay = rowDelay + 0.25;
  const rank = index + 1;

  const pct =
    agent.tasksAssignedToday > 0
      ? agent.tasksCompletedToday / agent.tasksAssignedToday
      : 0;

  // Wrap row + divider in a single motion.div so AnimatePresence can track
  // them as one unit and layout animations stay coherent during re-ranks.
  return (
    <motion.div
      layout
      variants={rowVariants}
      custom={rowDelay}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{
        layout: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
    >
      {/* Data grid */}
      <div
        className={`grid ${GRID_COLS} items-center gap-x-5 px-3 py-[1.3vh] rounded-xl hover:bg-white/[0.025] transition-colors duration-300 group`}
      >
        {/* Col 1 — Rank */}
        <RankBadge rank={rank} />

        {/* Col 2 — Avatar ring */}
        <PerformanceRing name={agent.name} pct={pct} animDelay={ringDelay} />

        {/* Col 3 — Agent name */}
        <p className="font-baskerville text-[2rem] tracking-wide text-champagne leading-none truncate font-medium">
          {agent.name}
        </p>

        {/* Col 4 — RUNRATE: completed / assigned */}
        <div className="flex items-baseline justify-center gap-[6px]">
          <AnimatedValue
            value={agent.tasksCompletedToday}
            className="font-edu text-[3rem] leading-none text-gold-400 tabular-nums font-semibold"
            style={{ textShadow: "0 0 18px rgba(201,168,76,0.45)" }}
          />
          <span className="font-inter text-[1.3rem] text-white/20 leading-none font-medium">
            /
          </span>
          <AnimatedValue
            value={agent.tasksAssignedToday}
            className="font-inter text-[1.8rem] text-white/40 leading-none tabular-nums font-medium"
          />
        </div>

        {/* Col 5 — MONTHLY total */}
        <div className="flex justify-end pr-1">
          <AnimatedValue
            value={agent.tasksCompletedThisMonth}
            className="font-edu text-[2.8rem] leading-none tabular-nums font-semibold"
            style={{
              color:
                rank === 1 ? "rgba(201,168,76,0.82)" : "rgba(190,190,190,0.60)",
            }}
          />
        </div>
      </div>

      {/* Hairline row divider */}
      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-gold-500/[0.06] to-transparent" />
    </motion.div>
  );
}

// ── Leaderboard (exported) ────────────────────────────────────────────────────
interface AgentLeaderboardProps {
  agents: AgentStats[];
  queendomDelay?: number;
}

export default function AgentLeaderboard({
  agents,
  queendomDelay = 0,
}: AgentLeaderboardProps) {
  return (
    <div className="flex flex-col flex-6 min-h-0">
      {/* Scroll container */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* ── Sticky header: section label + column labels ── */}
        <div
          className={`sticky top-0 z-10 backdrop-blur-sm border-b border-gold-500/[0.12] flex-shrink-0`}
        >
          {/* Section label row */}

          {/* Column label row */}
          <div className={`grid ${GRID_COLS} gap-x-5 px-3 pb-[0.9vh]`}>
            <span /> {/* rank */}
            <span /> {/* avatar */}
            <span className="font-inter text-[1rem] tracking-[0.45em] uppercase text-yellow-500/65 font-semibold pl-0.5">
              Agent
            </span>
            <span className="font-inter text-[1rem] tracking-[0.45em] uppercase text-yellow-500/65 font-semibold text-center">
              Runrate
            </span>
            <span className="font-inter text-[1rem] tracking-[0.45em] uppercase text-yellow-500/65 font-semibold text-right pr-1">
              Monthly
            </span>
          </div>
        </div>

        {/* Agent rows with layout-aware AnimatePresence for smooth re-ranks */}
        <div className="pt-[0.5vh]">
          <AnimatePresence mode="popLayout">
            {agents.map((agent, i) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                index={i}
                baseDelay={queendomDelay}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
