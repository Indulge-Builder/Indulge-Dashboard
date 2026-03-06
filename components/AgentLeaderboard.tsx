"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import type { AgentStats } from "@/lib/types";

// ─── Performance Ring ─────────────────────────────────────────────────────────
// Wraps the avatar initials in an SVG ring that animates to the agent's daily
// completion percentage. Using `key={offset}` on <motion.circle> forces a
// re-mount (and therefore re-animation) every time the live data changes.

const RING_SIZE = 50;
const RING_R = 20;
const CIRCUMFERENCE = 2 * Math.PI * RING_R; // ≈ 125.66

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

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
      {/* SVG — rotated so the arc starts at 12 o'clock */}
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
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="2.5"
        />
        {/*
          Gold progress arc.
          key={offset} — when live data pushes a new percentage, offset changes,
          React remounts this element, which restarts the animation from 0 → new value.
          This gives the satisfying "ring redraws" effect on every real-time update.
        */}
        <motion.circle
          key={offset}
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="#eab308"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: 1.5,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: animDelay,
          }}
          style={{ filter: "drop-shadow(0 0 5px rgba(234,179,8,0.55))" }}
        />
      </svg>

      {/* Initials overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-playfair text-[0.72rem] tracking-widest text-gold-400 select-none">
          {getInitials(name)}
        </span>
      </div>
    </div>
  );
}

// ─── Agent Row ────────────────────────────────────────────────────────────────
const rowVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay },
  }),
};

// Shared column template — header and every row use the same string for
// pixel-perfect alignment regardless of content width.
const GRID_COLS = "grid-cols-[1fr_152px_80px]";

interface RowProps {
  agent: AgentStats;
  index: number;
  baseDelay: number;
}

function AgentRow({ agent, index, baseDelay }: RowProps) {
  const rowDelay = baseDelay + index * 0.07;
  const ringDelay = rowDelay + 0.3;

  const pct =
    agent.tasksAssignedToday > 0
      ? agent.tasksCompletedToday / agent.tasksAssignedToday
      : 0;

  // All rows use animate — whileInView is unreliable inside overflow-y-auto
  // containers and causes rows to go invisible after a re-rank/sort.
  const motionProps = {
    variants: rowVariants,
    custom: rowDelay,
    initial: "hidden",
    animate: "visible",
  };

  return (
    <>
      <motion.div
        {...motionProps}
        className={`grid ${GRID_COLS} items-center gap-x-2 px-2 py-[0.95vh] rounded-xl hover:bg-white/[0.03] transition-colors duration-200 group`}
      >
        {/* ── Col 1: rank · ring · name ── */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-inter text-[0.78rem] text-gold-500/20 group-hover:text-gold-500/45 tabular-nums w-4 text-right flex-shrink-0 select-none transition-colors duration-200">
            {index + 1}
          </span>

          <PerformanceRing name={agent.name} pct={pct} animDelay={ringDelay} />

          <p className="font-playfair text-[1.35rem] tracking-wide text-champagne leading-none truncate">
            {agent.name}
          </p>
        </div>

        {/* ── Col 2: done / assigned fraction ── */}
        <div className="flex items-baseline justify-center gap-[6px]">
          <span
            className="font-edu text-[2.1rem] leading-none text-gold-400 tabular-nums"
            style={{ textShadow: "0 0 14px rgba(201,168,76,0.45)" }}
          >
            {agent.tasksCompletedToday}
          </span>
          <span className="font-inter text-[0.85rem] text-white/20 leading-none">
            /
          </span>
          <span className="font-inter text-[1.1rem] text-white/40 leading-none tabular-nums">
            {agent.tasksAssignedToday}
          </span>
        </div>

        {/* ── Col 3: this month total ── */}
        <div className="flex justify-end pr-1">
          <span className="font-edu text-[1.85rem] leading-none text-slate-300/75 tabular-nums">
            {agent.tasksCompletedThisMonth}
          </span>
        </div>
      </motion.div>

      {/* Hairline row divider */}
      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-gold-500/[0.07] to-transparent" />
    </>
  );
}

// ─── Leaderboard (exported) ───────────────────────────────────────────────────
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
      {/* Section label */}
      <div className="flex items-center gap-2 mb-[0.8vh] flex-shrink-0">
        <Trophy size={12} className="text-gold-500/50" />
        <span className="font-inter text-[12px] tracking-[0.45em] uppercase text-gold-500/50">
          Team Leaderboard
        </span>
      </div>

      {/* Scroll container */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gold-500/15 scrollbar-track-transparent">
        {/* Sticky column header */}
        <div
          className={`sticky top-0 z-10 grid ${GRID_COLS} gap-x-2 px-2 py-[1.2vh] bg-[#040302]/90 backdrop-blur-sm border-b border-gold-500/[0.14]`}
        >
          <span className="font-inter text-[9px] tracking-[0.55em] uppercase text-yellow-500/65 pl-[52px]">
            Agent
          </span>
          <span className="font-inter text-[9px] tracking-[0.55em] uppercase text-yellow-500/65 text-center">
            Daily Progress
          </span>
          <span className="font-inter text-[9px] tracking-[0.55em] uppercase text-yellow-500/65 text-right pr-1">
            This Month
          </span>
        </div>

        {/* Agent rows */}
        <div className="pt-[0.4vh]">
          {agents.map((agent, i) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              index={i}
              baseDelay={queendomDelay}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
