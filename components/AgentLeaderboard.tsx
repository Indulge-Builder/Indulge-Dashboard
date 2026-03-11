"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Crown } from "lucide-react";
import type { AgentStats } from "@/lib/types";

// ── Ring constants ────────────────────────────────────────────────────────────
const RING_SIZE = 80;
const RING_R = 32;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

// ── 4-column grid: [avatar | name | runrate | monthly] ───────────────────────
// The rank column has been removed entirely. The Crown for rank 1 is
// overlaid on the avatar ring. Saved space is redistributed to Name (via
// the wider 1fr track) and Runrate (explicit bump per breakpoint).
const GRID_COLS =
  "grid-cols-[3rem_1fr_8rem_4.5rem] " +
  "sm:grid-cols-[4rem_1fr_10rem_6rem] " +
  "lg:grid-cols-[5.5rem_1fr_14rem_8rem]";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── Animated number ───────────────────────────────────────────────────────────
// Detects value changes from live data and plays a soft blur-fade-in.
// This component is intentionally self-contained — it must not rely on
// anything in the parent motion tree that could interfere with its animation.
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
// SVG arc progress ring. When `isTopRanked` is true, a gold-glowing Crown
// is pinned to the top of the ring container instead of a separate rank column.
interface RingProps {
  name: string;
  pct: number;
  animDelay: number;
  isTopRanked?: boolean;
}

function PerformanceRing({
  name,
  pct,
  animDelay,
  isTopRanked = false,
}: RingProps) {
  const clampedPct = Math.min(Math.max(pct, 0), 1);
  const offset = CIRCUMFERENCE * (1 - clampedPct);

  return (
    <div className="relative flex-shrink-0 w-[48px] h-[48px] sm:w-[60px] sm:h-[60px] lg:w-[80px] lg:h-[80px]">
      {/* Crown badge — rank 1 only, floats above the ring */}
      {isTopRanked && (
        <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
          <Crown
            className="w-[13px] h-[13px] sm:w-[15px] sm:h-[15px] lg:w-[18px] lg:h-[18px] text-gold-400"
            style={{
              filter:
                "drop-shadow(0 0 5px rgba(201,168,76,0.95)) drop-shadow(0 0 14px rgba(201,168,76,0.55))",
            }}
          />
        </div>
      )}

      {/* SVG arc — rotated so the arc starts at 12 o'clock */}
      <svg
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 -rotate-90 w-full h-full"
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
        {/* Warm-gold progress arc — key={offset} remounts on every data push */}
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

      {/* Initials — centered inside the ring */}
      <div
        className="absolute inset-0 flex items-center justify-center rounded-full"
        style={{ border: "1px solid rgba(201,168,76,0.14)" }}
      >
        <span className="font-playfair text-[0.65rem] sm:text-[0.85rem] lg:text-[1.05rem] tracking-widest text-gold-400 select-none">
          {getInitials(name)}
        </span>
      </div>
    </div>
  );
}

// ── Agent row ─────────────────────────────────────────────────────────────────
// FIX: The original code used `variants + custom` where `custom={rowDelay}`
// was recomputed from `index` on every re-rank. Framer Motion re-evaluates
// the variant function whenever `custom` changes, triggering a fresh entrance
// animation (with its new delay). This delayed re-animation window runs
// concurrently with — and visually swamps — the AnimatedValue glow, making
// live number updates invisible on screen.
//
// Fix: use direct `initial/animate` values (Framer Motion won't re-animate
// when the target is identical to the current value), and lock the entrance
// delay to the mount-time value via useRef so it never changes on re-rank.
interface RowProps {
  agent: AgentStats;
  index: number;
  baseDelay: number;
}

function AgentRow({ agent, index, baseDelay }: RowProps) {
  const rank = index + 1;

  // Capture entrance delay once at mount. On live re-ranks `index` shifts,
  // but entranceDelay stays frozen so no re-fire of the entrance animation.
  const entranceDelay = useRef(baseDelay + index * 0.07).current;
  const ringDelay = useRef(entranceDelay + 0.25).current;

  const pct =
    agent.tasksAssignedToday > 0
      ? agent.tasksCompletedToday / agent.tasksAssignedToday
      : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        // Per-property delays so the layout animation is never delayed.
        opacity: {
          duration: 0.55,
          ease: [0.25, 0.46, 0.45, 0.94],
          delay: entranceDelay,
        },
        y: {
          duration: 0.55,
          ease: [0.25, 0.46, 0.45, 0.94],
          delay: entranceDelay,
        },
        layout: { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
    >
      {/* 4-column data grid */}
      <div
        className={`grid ${GRID_COLS} items-center gap-x-2 sm:gap-x-3 lg:gap-x-5 px-2 sm:px-3 py-[1vh] sm:py-[1.3vh] rounded-xl hover:bg-white/[0.025] transition-colors duration-300 group`}
      >
        {/* Col 1 — Avatar ring (Crown overlaid for rank 1) */}
        <PerformanceRing
          name={agent.name}
          pct={pct}
          animDelay={ringDelay}
          isTopRanked={rank === 1}
        />

        {/* Col 2 — Agent name */}
        <p className="font-baskerville text-[clamp(0.85rem,1.5vw,2rem)] tracking-wide text-champagne leading-none truncate font-medium">
          {agent.name}
        </p>

        {/* Col 3 — RUNRATE: completed / assigned */}
        <div className="flex items-baseline justify-center gap-[4px] sm:gap-[6px]">
          <AnimatedValue
            value={agent.tasksCompletedToday}
            className="font-edu text-[clamp(1.5rem,2.4vw,3rem)] leading-none text-gold-400 tabular-nums font-semibold"
            style={{ textShadow: "0 0 18px rgba(201,168,76,0.45)" }}
          />
          <span className="font-inter text-[clamp(0.8rem,0.9vw,1.3rem)] text-white/20 leading-none font-medium">
            /
          </span>
          <AnimatedValue
            value={agent.tasksAssignedToday}
            className="font-inter text-[clamp(1rem,1.4vw,1.8rem)] text-white/40 leading-none tabular-nums font-medium"
          />
        </div>

        {/* Col 4 — MONTHLY total */}
        <div className="flex justify-end pr-1">
          <AnimatedValue
            value={agent.tasksCompletedThisMonth}
            className="font-edu text-[clamp(1.3rem,2vw,2.8rem)] leading-none tabular-nums font-semibold"
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scroll container */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* ── Sticky header: column labels ── */}
        <div className="sticky top-0 z-10 backdrop-blur-sm border-b border-gold-500/[0.12] flex-shrink-0">
          <div
            className={`grid ${GRID_COLS} gap-x-2 sm:gap-x-3 lg:gap-x-5 px-2 sm:px-3 pb-[0.9vh]`}
          >
            <span /> {/* avatar — no label */}
            <span className="font-inter text-[clamp(0.6rem,0.85vw,1rem)] tracking-[0.45em] uppercase text-yellow-500/65 font-semibold pl-0.5">
              Agent
            </span>
            <span className="font-inter text-[clamp(0.6rem,0.85vw,1rem)] tracking-[0.45em] uppercase text-yellow-500/65 font-semibold text-center">
              Runrate
            </span>
            <span className="font-inter text-[clamp(0.6rem,0.85vw,1rem)] tracking-[0.45em] uppercase text-yellow-500/65 font-semibold text-right pr-1">
              Monthly
            </span>
          </div>
        </div>

        {/* Agent rows — AnimatePresence handles smooth re-ranks via layout */}
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
