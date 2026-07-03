"use client";

/**
 * components/leaderboard/AgentIcon.tsx
 *
 * Circular progress ring with agent initials (neumorphic reskin).
 * The ring fill represents completedToday / assignedToday (0–1) and gets
 * RICHER as it fills: stroke width thickens 3 → 5.2 and the stroke color
 * brightens from putty (--neu-text-tertiary) toward the hue — honey gold for
 * rank 1 (crown), sage for everyone else. A sage ✓ coin pops in at 100%.
 * The crown floats gently above rank 1's ring (CSS keyframe, transform-only).
 *
 * Memoized — re-renders only when pct, name, or showCrown changes.
 */

import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { getInitials } from "@/lib/format";
import { EASE_LUXURY } from "@/lib/motionPresets";

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
  const done       = clampedPct >= 1;

  // Richer-as-it-fills ring: width 3 → 5.2, hue mix 42% → 100% toward the
  // accent (rank 1) or sage hue. Both transition via CSS (0.8s ease).
  const hue = showCrown ? "var(--neu-accent-deep)" : "var(--neu-sage-deep)";
  const ringWidth = 3 + 2.2 * clampedPct;
  const ringColor = `color-mix(in srgb, ${hue} ${Math.round(
    42 + 58 * clampedPct,
  )}%, var(--neu-text-tertiary))`;

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
          stroke="color-mix(in srgb, var(--neu-accent-deep) 16%, transparent)"
          strokeWidth="3"
        />
        {/* Progress arc — draws in once on mount, then retargets smoothly;
            stroke color + width glide via CSS as completion rises */}
        <motion.circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke={ringColor}
          strokeWidth={ringWidth}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={arcTransition}
          style={{ transition: "stroke 0.8s ease, stroke-width 0.8s ease" }}
        />
      </svg>

      {/* Initials badge */}
      {/* min 14px at base breakpoint */}
      <div className="absolute inset-0 flex items-center justify-center rounded-full">
        <span className="font-cinzel font-bold text-[0.875rem] sm:text-[1rem] lg:text-[1rem] tracking-widest text-neu-t1 select-none">
          {getInitials(name)}
        </span>
      </div>

      {/* Sage ✓ coin — pops in when today's assignments are 100% complete */}
      {done && (
        <span
          className="neu-anim-pop absolute -right-[4px] -top-[2px] z-10 flex items-center justify-center rounded-full border border-neu-edge bg-neu-sage shadow-neu-sm font-montserrat font-extrabold leading-none select-none"
          style={{
            width: "clamp(14px, 1.6cqw, 26px)",
            height: "clamp(14px, 1.6cqw, 26px)",
            fontSize: "clamp(9px, 0.9cqw, 15px)",
            color: "#26301F",
          }}
          aria-label="All of today's tickets resolved"
        >
          ✓
        </span>
      )}

      {/* Crown for rank 1 — floats gently (CSS transform keyframe) */}
      {showCrown && (
        <div className="absolute -top-[10px] sm:-top-[13px] lg:-top-[16px] left-1/2 -translate-x-1/2 z-10">
          <div className="neu-anim-crown-float">
            <Crown className="text-neu-accent-deep w-[12px] h-[12px] sm:w-[15px] sm:h-[15px] lg:w-[18px] lg:h-[18px]" />
          </div>
        </div>
      )}
    </div>
  );
});
