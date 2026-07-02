"use client";

/**
 * components/AnimatedValue.tsx
 *
 * Numeric display that pops (scale + optional emerald ghost) when the value
 * increases (dry-audit B3 — moved out of AgentRow so it's discoverable and
 * not re-invented). Visually distinct from AnimatedCounter by design:
 * AnimatedCounter is the spring count-up for hero metrics; AnimatedValue is
 * the scale-pop for leaderboard cells. Do not merge them.
 */

import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EASE_LUXURY, gpuStyle } from "@/lib/motionPresets";
import { usePrevious } from "@/hooks/usePrevious";

interface AnimatedValueProps {
  value: number;
  className?: string;
  style?: React.CSSProperties;
  highlightOnIncrease?: boolean;
}

export const AnimatedValue = memo(function AnimatedValue({
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
      {/* Primary value — pops on increase */}
      <motion.span
        key={`base-${changePulse}-${value}`}
        style={gpuStyle}
        animate={
          increased
            ? { scale: [1.3, 1], opacity: [0.85, 1] }
            : { scale: 1, opacity: 1 }
        }
        transition={{ duration: 0.5, ease: EASE_LUXURY }}
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
          animate={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE_LUXURY }}
          aria-hidden
        >
          {value}
        </motion.span>
      )}
    </span>
  );
});
