/**
 * lib/motionPresets.ts — Shared Framer Motion constants for the Indulge TV dashboard.
 *
 * Goals:
 *   - Single source of truth for animation durations, easings, and variants.
 *   - GPU promotion via will-change + translateZ(0) on every animated element.
 *   - Eliminates repeated inline `transition` / `initial` / `animate` objects.
 *
 * Usage:
 *   import { gpuStyle, itemVariants, containerVariants } from "@/lib/motionPresets";
 *
 *   <motion.div style={gpuStyle} variants={itemVariants} ... />
 */

import type { CSSProperties } from "react";
import type { Transition, Variants } from "framer-motion";

// ─── GPU layer hint ───────────────────────────────────────────────────────────
/**
 * Spread onto the `style` prop of any Framer Motion element to promote it to
 * its own GPU compositing layer. Prevents paint jank on 24/7 TV hardware.
 *
 * @example
 *   <motion.div style={gpuStyle} animate={{ opacity: 1 }} />
 */
export const gpuStyle: CSSProperties = {
  willChange: "transform, opacity",
  transform: "translateZ(0)",
};

// ─── Luxury easing curve ──────────────────────────────────────────────────────
/** Matches the CSS `--ease-luxury` variable: smooth deceleration. */
export const EASE_LUXURY = [0.25, 0.46, 0.45, 0.94] as const;

// ─── Stagger container + item pair ───────────────────────────────────────────
/**
 * Parent container that stagger-animates children on mount.
 * Pair with `itemVariants` on each child.
 *
 * @example
 *   <motion.section variants={containerVariants} initial="hidden" animate="visible">
 *     <motion.div variants={itemVariants} />
 *   </motion.section>
 */
export const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.2,
    },
  },
};

/**
 * Child item — fades up 28px from below.
 * Used in QueendomPanel sections (scorecard, renewals, leaderboard, joker, finances).
 */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: EASE_LUXURY,
    },
  },
};

// ─── Screen crossfade (DashboardController) ───────────────────────────────────
/**
 * 1.5-second cinematic crossfade for the concierge ↔ onboarding screen switch.
 * Used on `opacity` and `zIndex` in DashboardController.
 */
export const crossfadeTransition: Transition = {
  duration: 1.5,
  ease: "easeInOut",
};

// ─── Widget fade-in (ActiveOutlays, OnboardingPanel sections) ─────────────────
/**
 * Returns Framer Motion props for a lightweight fade-in with optional delay.
 * Hardware-accelerated: only animates `opacity` and `y` (transform).
 *
 * @param delayMs - delay before animation starts (in milliseconds)
 *
 * @example
 *   <motion.div {...widgetFadeIn(delayMs)} />
 */
export function widgetFadeIn(delayMs = 0) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: delayMs / 1000, duration: 0.5 },
  } as const;
}

// ─── Leaderboard row entrance ─────────────────────────────────────────────────
/**
 * Row entrance variant for AgentLeaderboard.
 * Uses `custom` prop for per-row delay (seconds).
 *
 * TV-grade: only animates `opacity` and `y` (compositor-only, no layout/paint).
 * Each row fades up 18 px with 50 ms stagger — data arriving with confidence,
 * never a stretch or clip.
 *
 * @example
 *   <motion.div variants={rowVariants} custom={rowDelay} initial="hidden" animate="visible" exit="exit" />
 */
export const rowVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: EASE_LUXURY,
      delay,
    },
  }),
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.3, ease: [0.4, 0, 1, 1] },
  },
};

// ─── Surge / win flash (AgentRow score increase) ──────────────────────────────
/** Gold background burst — fades from 0.9 → 0 opacity over 0.8s. */
export const surgeBgVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: [0.9, 0], scale: [0.98, 1] },
  transition: { duration: 0.8, ease: "easeOut" as const },
};

/** Horizontal shimmer sweep across a row on score increase. */
export const surgeSweepVariants = {
  initial: { opacity: 1 },
  animate: { opacity: [1, 1, 0] },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

export const surgeSweepBarVariants = {
  initial: { x: "-100%" },
  animate: { x: "200%" },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

// ─── Win shimmer (leaderboard row while celebration is active) ────────────────
export const winShimmerBarVariants = {
  initial: { x: "-100%" },
  animate: { x: "300%" },
  transition: {
    duration: 1.2,
    ease: EASE_LUXURY,
  },
};
