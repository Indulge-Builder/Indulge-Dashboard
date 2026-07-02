"use client";

/**
 * components/ui/RotatingViews.tsx
 *
 * In-place auto-rotation between sibling views — the band-level cousin of
 * DashboardController's ScreenLayer, following the exact same TV invariants:
 *
 *   - Every view stays ALWAYS MOUNTED (never unmount to "optimize"); rotation
 *     is a crossfade on opacity/transform only, with `visibility: hidden`
 *     applied after the fade-out (transitionEnd) so hidden views leave the
 *     GPU paint path on 24/7 hardware.
 *   - Each view is wrapped in ScreenActivityContext so children's own clocks
 *     (1s ticks, marquee keyframes) pause while their view is hidden. The
 *     provided value is `screenActive && isCurrentView` — nesting under a
 *     rotating screen composes correctly.
 *   - The rotation timer itself pauses while the host screen is inactive.
 *
 * Motion: outgoing view drifts up 12px as it fades; while invisible it resets
 * below (+12px), so every entrance rises — one continuous upward carousel.
 */

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ScreenActivityContext, useScreenActive } from "@/hooks/useScreenActive";
import { EASE_LUXURY, gpuStyle } from "@/lib/motionPresets";

const DRIFT_PX = 12;
const CROSSFADE_S = 1.1;
const DEFAULT_DWELL_MS = 15_000;

interface RotatingViewsProps {
  /** The views to rotate through, in order. All stay mounted. */
  views: ReactNode[];
  /**
   * Dwell (ms) before rotating to the next view — one value for all views,
   * or an array with one dwell per view index (asymmetric rotation, e.g.
   * `[40_000, 10_000]` = view 0 holds 40 s, view 1 holds 10 s).
   */
  intervalMs?: number | number[];
  /** Extra classes on the relative wrapper (e.g. z-index). */
  className?: string;
}

export function RotatingViews({
  views,
  intervalMs = DEFAULT_DWELL_MS,
  className,
}: RotatingViewsProps) {
  const screenActive = useScreenActive();
  const [index, setIndex] = useState(0);

  // Resolved to a primitive so re-renders mid-dwell (live stats patches) never
  // reset the timer — the effect only re-arms when the dwell or index changes.
  const dwellMs = Array.isArray(intervalMs)
    ? intervalMs[index % intervalMs.length] ?? DEFAULT_DWELL_MS
    : intervalMs;

  useEffect(() => {
    if (!screenActive || views.length < 2) return;
    const id = window.setTimeout(
      () => setIndex((i) => (i + 1) % views.length),
      dwellMs,
    );
    return () => window.clearTimeout(id);
  }, [screenActive, views.length, dwellMs, index]);

  // Snap back to the default view while the host screen is faded out, so every
  // screen visit starts a deterministic cycle at view 0 (the swap happens
  // invisibly — hidden layers are visibility:hidden).
  useEffect(() => {
    if (!screenActive) setIndex(0);
  }, [screenActive]);

  return (
    <div className={`relative h-full w-full ${className ?? ""}`}>
      {views.map((view, i) => {
        const isActive = i === index;
        return (
          <motion.div
            key={i}
            className="absolute inset-0"
            style={{ ...gpuStyle, pointerEvents: isActive ? "auto" : "none" }}
            initial={false}
            animate={
              isActive
                ? { opacity: 1, y: 0, zIndex: 2, visibility: "visible" as const }
                : {
                    opacity: 0,
                    y: -DRIFT_PX,
                    zIndex: 1,
                    transitionEnd: {
                      visibility: "hidden" as const,
                      y: DRIFT_PX,
                    },
                  }
            }
            transition={{ duration: CROSSFADE_S, ease: EASE_LUXURY }}
          >
            <ScreenActivityContext.Provider value={screenActive && isActive}>
              {view}
            </ScreenActivityContext.Provider>
          </motion.div>
        );
      })}
    </div>
  );
}
