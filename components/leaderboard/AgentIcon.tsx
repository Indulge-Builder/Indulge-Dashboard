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

import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { getInitials } from "@/lib/format";
import { EASE_LUXURY } from "@/lib/motionPresets";
import { fw } from "@/lib/tvScale";

// ── Stage-pinned sizes (handoff §B2: 66px ring, 14.4px initials, 18px crown) ──
const ICON_STYLE = { width: fw(66), height: fw(66) };
const INITIALS_STYLE = { fontSize: fw(14.4, 0.6), letterSpacing: "0.1em" };
const CROWN_STYLE = { width: fw(18, 0.6), height: fw(18, 0.6) };
const CROWN_TOP = `calc(-1 * ${fw(12, 0.6)})`;

// ── Ring geometry ─────────────────────────────────────────────────────────────
const RING_SIZE    = 80;
const RING_R       = 32;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

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

  // Entrance (staggered draw-in from empty) happens exactly once; live pct
  // updates retarget the arc from its CURRENT fill — no remount, no wipe from
  // zero, no re-applied stagger delay on a real-time change.
  const hasEnteredRef = useRef(false);
  useEffect(() => {
    hasEnteredRef.current = true;
  }, []);
  const arcTransition = hasEnteredRef.current
    ? { type: "tween" as const, duration: 0.8, ease: EASE_LUXURY }
    : { type: "tween" as const, duration: 1.2, ease: EASE_LUXURY, delay: animDelay };

  return (
    <div className="relative flex-shrink-0" style={ICON_STYLE}>
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
        {/* Progress arc — draws in once on mount, then retargets smoothly */}
        <motion.circle
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
          transition={arcTransition}
        />
      </svg>

      {/* Initials badge */}
      <div className="absolute inset-0 flex items-center justify-center rounded-full border border-gold-500/30">
        <span className="font-cinzel text-gold-400 select-none" style={INITIALS_STYLE}>
          {getInitials(name)}
        </span>
      </div>

      {/* Crown for rank 1 */}
      {showCrown && (
        <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: CROWN_TOP }}>
          <Crown className="text-gold-400" style={CROWN_STYLE} />
        </div>
      )}
    </div>
  );
});
