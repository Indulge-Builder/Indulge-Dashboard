"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Crown } from "lucide-react";
import type { AgentStats } from "@/lib/types";

// ── Ring constants ────────────────────────────────────────────────────────────
const RING_SIZE = 80;
const RING_R = 32;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

// ── 5-column TV grid ─────────────────────────────────────────────────────────
// Columns: [avatar | name | runrate (daily) | monthly | overdue]
//
// Sizing philosophy:
//   • Avatar column = slightly wider than the ring itself to breathe with the Crown badge
//   • Name = 1fr (greedy — fills all remaining space)
//   • Runrate = wide enough for "42 / 68" at large font; centred
//   • Monthly = single number, right-aligned
//   • Overdue = compact amber warning number, right-aligned
//
// At xl (≥1280px — typical 1920-wide TV):
//   Fixed cols: 5.5+11+7+5.5 rem = 29rem = ~464px
//   Gaps (4×): 4 × 1.5rem = 6rem = ~96px
//   Panel padding: ~36px each side → grid ≈ 878px
//   Name (1fr) = 878 − 464 − 96 ≈ 318px → ample for most names (truncate handles overflow)
const GRID_COLS =
  "grid-cols-[3rem_1fr_7rem_4.5rem_4rem] " +
  "lg:grid-cols-[4.5rem_1fr_9.5rem_6rem_5rem] " +
  "xl:grid-cols-[5.5rem_1fr_11rem_7rem_5.5rem]";

// Shared gap class — kept in one place so header and rows always match
const GRID_GAP = "gap-x-2 lg:gap-x-4 xl:gap-x-6";

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── Animated number ───────────────────────────────────────────────────────────
// Detects live value changes and plays a soft blur-fade-in. Intentionally
// self-contained so no ancestor motion animation can interfere with it.
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
// When `isTopRanked` is true, a gold-glowing Crown is pinned above the ring
// instead of a separate rank-number column.
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
    <div className="relative flex-shrink-0 w-[48px] h-[48px] lg:w-[64px] lg:h-[64px] xl:w-[76px] xl:h-[76px]">
      {/* Crown — rank 1 only, floats just above the ring */}
      {isTopRanked && (
        <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 z-20 flex items-center justify-center">
          <Crown
            className="w-[12px] h-[12px] lg:w-[15px] lg:h-[15px] xl:w-[17px] xl:h-[17px] text-gold-400"
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
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="2.5"
        />
        {/* key={offset} forces arc remount on every live data push */}
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

      {/* Initials — centred inside the ring */}
      <div
        className="absolute inset-0 flex items-center justify-center rounded-full"
        style={{ border: "1px solid rgba(201,168,76,0.14)" }}
      >
        <span className="font-playfair text-[0.6rem] lg:text-[0.8rem] xl:text-[0.95rem] tracking-widest text-gold-400 select-none">
          {getInitials(name)}
        </span>
      </div>
    </div>
  );
}

// ── Agent row ─────────────────────────────────────────────────────────────────
// LIVE UPDATE FIX (preserved from previous session):
//   animate target is always { opacity: 1, y: 0 } — a stable object Framer
//   Motion won't re-animate when the same values are already in place.
//   Entrance delay is frozen at mount via useRef so re-ranks (index change)
//   never re-trigger the entrance animation and mask AnimatedValue glows.
interface RowProps {
  agent: AgentStats;
  index: number;
  baseDelay: number;
}

function AgentRow({ agent, index, baseDelay }: RowProps) {
  const rank = index + 1;

  // Lock entrance delay at mount — index shifts on re-rank but delay stays frozen
  const entranceDelay = useRef(baseDelay + index * 0.06).current;
  const ringDelay     = useRef(entranceDelay + 0.22).current;

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
        opacity: { duration: 0.5,  ease: [0.25, 0.46, 0.45, 0.94], delay: entranceDelay },
        y:       { duration: 0.5,  ease: [0.25, 0.46, 0.45, 0.94], delay: entranceDelay },
        layout:  { duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] },
      }}
    >
      {/* 5-column data grid */}
      <div
        className={`grid ${GRID_COLS} ${GRID_GAP} items-center px-2 lg:px-3 py-[1.05vh] rounded-xl hover:bg-white/[0.025] transition-colors duration-300 group`}
      >
        {/* Col 1 — Avatar ring (Crown badge for rank 1) */}
        <PerformanceRing
          name={agent.name}
          pct={pct}
          animDelay={ringDelay}
          isTopRanked={rank === 1}
        />

        {/* Col 2 — Agent name */}
        <p className="font-baskerville text-[clamp(0.82rem,1.4vw,1.9rem)] tracking-wide text-champagne leading-none truncate font-medium">
          {agent.name}
        </p>

        {/* Col 3 — Daily Runrate: completed / assigned */}
        <div className="flex items-baseline justify-center gap-[3px] lg:gap-[5px]">
          <AnimatedValue
            value={agent.tasksCompletedToday}
            className="font-edu text-[clamp(1.4rem,2.3vw,2.9rem)] leading-none text-gold-400 tabular-nums font-semibold"
            style={{ textShadow: "0 0 16px rgba(201,168,76,0.40)" }}
          />
          <span className="font-inter text-[clamp(0.75rem,0.85vw,1.2rem)] text-white/20 leading-none">
            /
          </span>
          <AnimatedValue
            value={agent.tasksAssignedToday}
            className="font-inter text-[clamp(0.9rem,1.3vw,1.7rem)] text-white/38 leading-none tabular-nums"
          />
        </div>

        {/* Col 4 — Monthly total resolved */}
        <div className="flex justify-end">
          <AnimatedValue
            value={agent.tasksCompletedThisMonth}
            className="font-edu text-[clamp(1.2rem,1.9vw,2.7rem)] leading-none tabular-nums font-semibold"
            style={{
              color: rank === 1 ? "rgba(201,168,76,0.85)" : "rgba(190,190,190,0.55)",
            }}
          />
        </div>

        {/* Col 5 — Overdue / backlog tickets (amber warning accent) */}
        <div className="flex justify-end">
          <AnimatedValue
            value={agent.overdueCount}
            className="font-edu text-[clamp(1.2rem,1.9vw,2.7rem)] leading-none tabular-nums font-semibold"
            style={{
              // Escalate visual weight: 0 is near-invisible, any value glows amber
              color:
                agent.overdueCount > 0
                  ? "rgba(217,119,6,0.88)"
                  : "rgba(217,119,6,0.22)",
              textShadow:
                agent.overdueCount > 0
                  ? "0 0 14px rgba(217,119,6,0.35)"
                  : "none",
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
      {/* Scroll container — overflow-y-auto lets users scroll to see all agents
          while the vh math guarantees ≥4 rows are visible without any scroll. */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ── Sticky column header ── */}
        <div className="sticky top-0 z-10 backdrop-blur-sm border-b border-gold-500/[0.12] flex-shrink-0">
          <div className={`grid ${GRID_COLS} ${GRID_GAP} px-2 lg:px-3 pb-[0.8vh]`}>
            <span /> {/* avatar */}
            <span className="font-inter text-[clamp(0.55rem,0.78vw,0.95rem)] tracking-[0.45em] uppercase text-yellow-500/60 font-semibold pl-0.5">
              Agent
            </span>
            <span className="font-inter text-[clamp(0.55rem,0.78vw,0.95rem)] tracking-[0.45em] uppercase text-yellow-500/60 font-semibold text-center">
              Runrate
            </span>
            <span className="font-inter text-[clamp(0.55rem,0.78vw,0.95rem)] tracking-[0.45em] uppercase text-yellow-500/60 font-semibold text-right">
              Monthly
            </span>
            <span
              className="font-inter text-[clamp(0.55rem,0.78vw,0.95rem)] tracking-[0.45em] uppercase font-semibold text-right"
              style={{ color: "rgba(217,119,6,0.55)" }}
            >
              Overdue
            </span>
          </div>
        </div>

        {/* Agent rows — AnimatePresence with layout for smooth live re-ranks */}
        <div className="pt-[0.4vh]">
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
