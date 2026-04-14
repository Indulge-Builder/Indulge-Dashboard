"use client";

/**
 * components/leaderboard/AgentIcon.tsx
 *
 * Circular gold-ring progress indicator with agent initials.
 * The ring fill represents completedToday / assignedToday (0–1).
 * A Crown icon appears above the ring for rank-1 agents.
 *
 * Memoized — re-renders only when pct, name, or showCrown changes.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_SIZE    = 80;
const RING_R       = 32;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface AgentIconProps {
  name:       string;
  /** Completion ratio 0–1 (completedToday / assignedToday). Clamped internally. */
  pct:        number;
  animDelay:  number;
  showCrown?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export const AgentIcon = memo(function AgentIcon({
  name,
  pct,
  animDelay,
  showCrown,
}: AgentIconProps) {
  const clampedPct = Math.min(Math.max(pct, 0), 1);
  const offset     = CIRCUMFERENCE * (1 - clampedPct);

  return (
    <div className="relative flex-shrink-0 w-[44px] h-[44px] sm:w-[56px] sm:h-[56px] lg:w-[72px] lg:h-[72px]">
      <svg
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="absolute inset-0 -rotate-90 w-full h-full"
        style={{ overflow: "visible" }}
      >
        {/* Track ring */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="2.5"
        />
        {/* Progress arc — animates from 0 to offset on mount / pct change */}
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

      {/* Initials badge */}
      <div className="absolute inset-0 flex items-center justify-center rounded-full border border-gold-500/30">
        <span className="font-cinzel text-[0.6rem] sm:text-[0.8rem] lg:text-[1rem] tracking-widest text-gold-400 select-none">
          {getInitials(name)}
        </span>
      </div>

      {/* Crown for rank 1 */}
      {showCrown && (
        <div className="absolute -top-[8px] sm:-top-[10px] lg:-top-[12px] left-1/2 -translate-x-1/2 z-10">
          <Crown className="text-gold-400 w-[12px] h-[12px] sm:w-[15px] sm:h-[15px] lg:w-[18px] lg:h-[18px]" />
        </div>
      )}
    </div>
  );
});
